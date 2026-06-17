import { Op, Transaction } from 'sequelize';
import sequelize from '@config/database';
import Order from './order.model';
import OrderItem from './order-item.model';
import Address from '@modules/address/address.model';
import Wallet from '@modules/wallet/wallet.model';
import WalletTransaction from '@modules/wallet/wallet-transaction.model';
import User from '@modules/user/user.model';
import couponService from '@modules/coupon/coupon.service';
import CartItem from '@modules/cart/cart-item.model';
import PendingOrder from './pending-order.model';
import Product from '@modules/product/product.model';
import ProductImage from '@modules/product/product-image.model';
import ProductVariant from '@modules/product/product-variant.model';
import { syncProductStockFromVariants } from '@modules/product/productStock.util';
import ProductColor from '@modules/product/product-color.model';
import ProductColorImage from '@modules/product/product-color-image.model';
import ProductReview from '@modules/product/product-review.model';
import ProductReviewImage from '@modules/product/product-review-image.model';
import Store from '@modules/store/store.model';
import Payment from '@modules/payment/payment.model';

import cartService from '@modules/cart/cart.service';
import {
  addCreateOrderJob,
  OrderItemSnapshot,
  OrderPricingSnapshot,
  type ResolvedCouponLine,
} from '@queues/orderQueue';
import { AppError } from '@utils/appError';
import logger from '@utils/logger';
import { getPublicDeliveryConfig, resolveDeliveryWaivedReason } from '@config/delivery.config';
import { resolveDeliveryQuote } from '@modules/delivery/deliveryQuote.service';
import addressService from '@modules/address/address.service';
import { buildShadowfaxReplayFromSubtotal } from '@modules/shadowfax/shadowfaxDelivery';
import { scheduleShadowfaxPlacementIfDelivery } from '@modules/shadowfax/shadowfaxPlacement.service';
import { getOrderDeliveryStatus } from './orderDeliveryStatus.service';
import { buildWalletPaidByOrderIds, resolveWalletAmountPaid } from './orderWalletPaid';
import { buildShadowfaxOrderIdByOrderIds, resolveShadowfaxOrderId } from './orderShadowfax';
import { buildOrderRefWhere } from './orderRef';
import { normalizeOrderStatusInput } from './order-status.constants';
import { transitionOrderStatus } from '@modules/shadowfax/tracking/order-status-transition.service';
import { publishOrderStatusChanged } from '@modules/shadowfax/tracking/order-status.publisher';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import { computeTaxOnSubtotal, getPlatformFee } from '@config/pricing.config';
import { VENDOR_SALES_ORDER_STATUSES, type DateRange } from '@modules/store/vendorDashboard.utils';
import type { CouponValidationContext } from '@modules/coupon/coupon.service';
import type { OrderStatus } from './order.model';
import type { CreateOrderInput } from './order.checkout.types';
import { NotificationType } from '@modules/notification/notification.types';
import { notifyUser } from '@modules/notification/notification.service';
import {
  notifyBuyerOrderStatus,
  notifyOrderPlacedAfterPayment,
  notifyPaymentCancelled,
} from '@modules/notification/notification.order';
import { failPendingPaymentsForOrder } from '@modules/payment/payment.service';

export type { CreateOrderInput } from './order.checkout.types';

const REFERRAL_REWARD_AMOUNT = parseFloat(process.env.REFERRAL_REWARD_AMOUNT ?? '100');

export type OrderLineItemMyReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string | null;
  images: Array<ReturnType<ProductReviewImage['toPublicJSON']>>;
};

export interface EnqueuedOrderResult {
  /** Use this ID to poll GET /orders/status/:jobId */
  jobId: string;
  message: string;
}

function buildCouponValidationContext(
  userId: string,
  subtotal: number,
  isFirstOrder: boolean,
  formatted: { items: unknown[] },
): CouponValidationContext {
  const items = formatted.items as Array<{
    productId: string;
    product?: { storeId?: string; categoryId?: string | null; subCategoryId?: string | null };
  }>;
  const storeIds = [...new Set(items.map((i) => i.product?.storeId).filter(Boolean))] as string[];
  const storeId = storeIds.length === 1 ? storeIds[0]! : null;
  const cartProductIds = [...new Set(items.map((i) => i.productId))];
  const cartCategoryIds = [
    ...new Set(
      items.flatMap((i) => {
        const p = i.product;
        if (!p) return [];
        return [p.categoryId, p.subCategoryId].filter((x): x is string => Boolean(x));
      }),
    ),
  ];
  return { userId, subtotal, isFirstOrder, storeId, cartProductIds, cartCategoryIds };
}

class OrderService {
  // ─── Producer: fast-validation → enqueue → 202 ─────────────────────────────

  /**
   * Validates the request quickly (address + cart existence + coupon) then
   * hands the heavy DB work off to the order worker via Redis/BullMQ.
   *
   * Target response time: < 50 ms regardless of server load.
   */
  async createFromCart(userId: string, input: CreateOrderInput): Promise<EnqueuedOrderResult> {
    const { addressId, deliveryType, couponCode, couponCodes, autoApply } = input;

    let address: Address | null = null;

    // ── Fast validation 1: address (explicit id or user's default) ─────────
    if (deliveryType === 'delivery') {
      if (addressId) {
        const addr = await Address.findOne({ where: { id: addressId, userId } });
        if (!addr) throw AppError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
        address = addr;
      } else {
        address = await addressService.getDefaultAddress(userId);
        if (!address) {
          throw AppError.badRequest(
            'Delivery address is required — set a default address or pass addressId',
            'ADDRESS_REQUIRED',
          );
        }
      }
      if (address.latitude === null || address.longitude === null) {
        throw AppError.badRequest(
          'Address must include latitude and longitude for delivery',
          'ADDRESS_COORDINATES_REQUIRED',
        );
      }
    }

    // ── Fast validation 2: cart ──────────────────────────────────────────────
    const cartData = await cartService.getCartForOrder(userId);
    if (!cartData) throw AppError.badRequest('Cart is empty', 'EMPTY_CART');

    const { cart, formatted } = cartData;
    const subtotal = formatted.subtotal;

    // ── Determine first-order eligibility (needed for coupon validation) ─────
    const completedOrderCount = await Order.count({ where: { userId, status: 'delivered' } });
    const isFirstOrder = completedOrderCount === 0;

    const couponCtx = buildCouponValidationContext(userId, subtotal, isFirstOrder, formatted);

    let discountAmount = 0;
    let deliveryChargeOverride: number | null = null;
    let resolvedCoupons: ResolvedCouponLine[] = [];

    const codesInput =
      couponCodes && couponCodes.length > 0 ? couponCodes : couponCode ? [couponCode] : [];

    if (codesInput.length > 0) {
      const stack = await couponService.validateStack(codesInput, couponCtx);
      discountAmount = stack.totalDiscount;
      if (stack.deliveryWaived) deliveryChargeOverride = 0;
      resolvedCoupons = stack.applied.map((a) => ({
        id: a.coupon.id,
        code: a.coupon.code,
        discountAmount: a.discountAmount,
      }));
    } else if (autoApply) {
      const best = await couponService.autoApplyBest(couponCtx);
      if (best) {
        if (best.coupon.type === 'FREE_DELIVERY') {
          deliveryChargeOverride = 0;
        } else {
          discountAmount = best.discountAmount;
        }
        resolvedCoupons = [
          {
            id: best.coupon.id,
            code: best.coupon.code,
            discountAmount: best.discountAmount,
          },
        ];
      }
    }

    // ── Price computation ────────────────────────────────────────────────────
    const taxAmount = computeTaxOnSubtotal(subtotal);
    const platformFee = getPlatformFee();
    const waivedByCoupon = deliveryChargeOverride === 0;
    const deliveryFeeWaived = deliveryType === 'pickup' || waivedByCoupon;

    const shadowfaxReplay =
      deliveryType === 'delivery' ? buildShadowfaxReplayFromSubtotal(subtotal, 'true') : null;

    let deliveryCharge = 0;
    let quotedDeliveryCharge: number | null = null;

    if (deliveryType === 'delivery') {
      const firstItem = formatted.items[0] as { product?: { storeId?: string } } | undefined;
      const storeId = firstItem?.product?.storeId;
      if (!storeId) {
        throw AppError.badRequest('Could not resolve store for delivery quote', 'STORE_NOT_FOUND');
      }

      const deliveryQuote = await resolveDeliveryQuote({
        userId,
        subtotal,
        storeId,
        addressId: (address as Address).id,
        deliveryWaivedByCoupon: waivedByCoupon,
        cartId: cart.id,
      });

      quotedDeliveryCharge = deliveryQuote.quotedDeliveryCharge;
      deliveryCharge = deliveryQuote.deliveryChargeApplied;

      const clientFeeRaw = input.deliveryCharge;
      if (clientFeeRaw !== undefined && clientFeeRaw !== null && !Number.isNaN(Number(clientFeeRaw))) {
        const clientFee = Number(clientFeeRaw);
        if (clientFee < 0) {
          throw AppError.badRequest('deliveryCharge cannot be negative', 'DELIVERY_CHARGE_INVALID');
        }
        if (Math.abs(clientFee - deliveryCharge) > 0.01) {
          throw AppError.badRequest(
            'deliveryCharge does not match live delivery quote',
            'DELIVERY_CHARGE_MISMATCH',
            {
              clientDeliveryCharge: clientFee,
              expectedDeliveryCharge: deliveryCharge,
              quotedDeliveryCharge,
              deliveryFeeWaived,
            },
          );
        }
      }
    }

    const totalAmount = parseFloat(
      Math.max(0, subtotal + taxAmount + platformFee + deliveryCharge - discountAmount).toFixed(2),
    );

    // ── Build order-item snapshots (prices locked at this moment) ─────────────
    const orderItems: OrderItemSnapshot[] = formatted.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      productName: (item.product as { name: string }).name,
      variantLabel: item.variant ? (item.variant as { label: string }).label : null,
      basePrice: item.basePrice,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      discountedBasePrice: item.discountedBasePrice,
      additionalPrice: item.additionalPrice,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.itemTotal,
      baseTotal: item.baseTotal,
    }));

    // Capture the exact cart-item IDs so the worker deletes only these rows
    const rawItems = (cart as unknown as { items: CartItem[] }).items ?? [];
    const cartItemIds = rawItems.map((i) => i.id);

    const pricing: OrderPricingSnapshot = {
      cartId: cart.id,
      cartItemIds,
      orderItems,
      subtotal,
      taxAmount,
      platformFee,
      deliveryCharge,
      totalAmount,
      discountAmount,
      resolvedCoupons,
      shadowfaxReplay,
    };

    // ── Create the PendingOrder tracking record ──────────────────────────────
    const pending = await PendingOrder.create({ userId, status: 'queued' });

    // ── Enqueue the job (persist resolved default address on delivery orders) ─
    const jobInput =
      deliveryType === 'delivery' && address
        ? { ...input, addressId: (address as Address).id }
        : input;
    const bullJobId = await addCreateOrderJob(userId, jobInput, pending.id, pricing);

    // Store the BullMQ job ID for debugging / Bull Board visibility
    await pending.update({ jobId: bullJobId });

    if (resolvedCoupons.length > 0) {
      for (const coupon of resolvedCoupons) {
        notifyUser(userId, NotificationType.COUPON_APPLIED, {
          code: coupon.code,
          discount: coupon.discountAmount,
        });
      }
    }

    return {
      jobId: pending.id, // pendingId is the stable client-facing token
      message: 'Order is being processed. Poll GET /orders/status/:jobId for the result.',
    };
  }

  // ─── Job-status polling ───────────────────────────────────────────────────────

  async getJobStatus(jobId: string, userId: string) {
    const pending = await PendingOrder.findOne({ where: { id: jobId, userId } });
    if (!pending) throw AppError.notFound('Job not found', 'JOB_NOT_FOUND');
    return pending.toPublicJSON();
  }

  // ─── List / detail ─────────────────────────────────────────────────────────────

  async listOrders(userId: string, status?: OrderStatus | OrderStatus[], page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const where: any = { userId };

    if (status) {
      where.status = status;
    } else {
      // Default: exclude pending orders (unpaid)
      where.status = { [Op.ne]: 'pending' };
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'storeId'],
              include: [
                { model: Store, as: 'store' },
                { model: ProductImage, as: 'images' },
              ],
            },
            {
              model: ProductVariant,
              as: 'variant',
              include: [
                {
                  model: ProductColor,
                  as: 'color',
                  include: [{ model: ProductColorImage, as: 'images' }],
                },
              ],
            },
          ],
        },
        { model: Payment, as: 'payments' },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const allProductIds = rows.flatMap(
      (o) => ((o as unknown as { items: OrderItem[] }).items ?? []).map((i) => i.productId),
    );
    const userReviewsMap = await this.buildUserReviewsMap(userId, [...new Set(allProductIds)]);
    const orderIds = rows.map((o) => o.id);
    const [walletPaidByOrderId, shadowfaxOrderIdByOrderId] = await Promise.all([
      buildWalletPaidByOrderIds(orderIds),
      buildShadowfaxOrderIdByOrderIds(orderIds),
    ]);

    return {
      orders: rows.map((o) =>
        this.formatOrder(o, userReviewsMap, walletPaidByOrderId, shadowfaxOrderIdByOrderId),
      ),
      total: count,
      page,
      limit,
    };
  }

  /**
   * Returns orders that contain items belonging to the vendor's store.
   */
  async listVendorOrders(
    vendorId: string,
    status?: OrderStatus,
    page = 1,
    limit = 20,
    range?: DateRange,
  ) {
    const offset = (page - 1) * limit;

    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    // Filter orders in WHERE — required Product include + findAndCountAll generates invalid SQL
    // (references items.* without joining order_items; address join uses wrong column).
    const storeOrderIds = sequelize.literal(
      `(SELECT DISTINCT oi.order_id FROM order_items oi INNER JOIN products p ON p.id = oi.product_id WHERE p.store_id = ${sequelize.escape(store.id)})`,
    );

    const where: Record<string, unknown> = { id: { [Op.in]: storeOrderIds } };
    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.ne]: 'pending' };
    }
    if (range) {
      where.createdAt = { [Op.gte]: range.start, [Op.lte]: range.end };
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'storeId'],
              include: [{ model: ProductImage, as: 'images' }],
            },
            {
              model: ProductVariant,
              as: 'variant',
              include: [
                {
                  model: ProductColor,
                  as: 'color',
                  include: [{ model: ProductColorImage, as: 'images' }],
                },
              ],
            },
          ],
        },
        { model: Address, as: 'address' },
        { model: Payment, as: 'payments' },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const orderIds = rows.map((o) => o.id);
    const [walletPaidByOrderId, shadowfaxOrderIdByOrderId] = await Promise.all([
      buildWalletPaidByOrderIds(orderIds),
      buildShadowfaxOrderIdByOrderIds(orderIds),
    ]);

    return {
      orders: rows.map((o) =>
        this.formatOrder(o, undefined, walletPaidByOrderId, shadowfaxOrderIdByOrderId),
      ),
      total: count,
      page,
      limit,
    };
  }

  /**
   * Returns a single order by ID if it contains items from the vendor's store.
   */
  async getVendorOrderById(orderId: string, vendorId: string) {
    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const storeOrderIds = sequelize.literal(
      `(SELECT DISTINCT oi.order_id FROM order_items oi INNER JOIN products p ON p.id = oi.product_id WHERE p.store_id = ${sequelize.escape(store.id)})`,
    );

    const orderRefWhere = await buildOrderRefWhere(orderId);

    const order = await Order.findOne({
      where: {
        [Op.and]: [orderRefWhere, { id: { [Op.in]: storeOrderIds } }],
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'storeId'],
              include: [{ model: ProductImage, as: 'images' }],
            },
            {
              model: ProductVariant,
              as: 'variant',
              include: [
                {
                  model: ProductColor,
                  as: 'color',
                  include: [{ model: ProductColorImage, as: 'images' }],
                },
              ],
            },
          ],
        },
        { model: Address, as: 'address' },
        { model: Payment, as: 'payments' },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'phone', 'email', 'profileImage'],
        },
      ],
    });

    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    const [walletPaidByOrderId, shadowfaxOrderIdByOrderId] = await Promise.all([
      buildWalletPaidByOrderIds([order.id]),
      buildShadowfaxOrderIdByOrderIds([order.id]),
    ]);
    const formatted = this.formatOrder(
      order,
      undefined,
      walletPaidByOrderId,
      shadowfaxOrderIdByOrderId,
    );
    const user = (order as unknown as { user?: User }).user;

    return {
      ...formatted,
      customer: user ? this.formatOrderCustomer(user) : null,
    };
  }

  /**
   * Returns paginated vendor orders within a date range and qualifying sales statuses.
   */
  async listVendorOrdersInRange(
    vendorId: string,
    range: { start: Date; end: Date },
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;

    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const storeOrderIds = sequelize.literal(
      `(SELECT DISTINCT oi.order_id FROM order_items oi INNER JOIN products p ON p.id = oi.product_id WHERE p.store_id = ${sequelize.escape(store.id)})`,
    );

    const { count, rows } = await Order.findAndCountAll({
      where: {
        id: { [Op.in]: storeOrderIds },
        status: { [Op.in]: [...VENDOR_SALES_ORDER_STATUSES] },
        createdAt: { [Op.gte]: range.start, [Op.lte]: range.end },
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'storeId'],
              include: [{ model: ProductImage, as: 'images' }],
            },
            {
              model: ProductVariant,
              as: 'variant',
              include: [
                {
                  model: ProductColor,
                  as: 'color',
                  include: [{ model: ProductColorImage, as: 'images' }],
                },
              ],
            },
          ],
        },
        { model: Address, as: 'address' },
        { model: Payment, as: 'payments' },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const orderIds = rows.map((o) => o.id);
    const [walletPaidByOrderId, shadowfaxOrderIdByOrderId] = await Promise.all([
      buildWalletPaidByOrderIds(orderIds),
      buildShadowfaxOrderIdByOrderIds(orderIds),
    ]);

    return {
      orders: rows.map((o) =>
        this.formatOrder(o, undefined, walletPaidByOrderId, shadowfaxOrderIdByOrderId),
      ),
      total: count,
      page,
      limit,
    };
  }

  async getOrderById(orderId: string, userId: string) {
    const orderRefWhere = await buildOrderRefWhere(orderId);

    const order = await Order.findOne({
      where: { ...orderRefWhere, userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'storeId'],
              include: [
                { model: Store, as: 'store' },
                { model: ProductImage, as: 'images' },
              ],
            },
            {
              model: ProductVariant,
              as: 'variant',
              include: [
                {
                  model: ProductColor,
                  as: 'color',
                  include: [{ model: ProductColorImage, as: 'images' }],
                },
              ],
            },
          ],
        },
        { model: Address, as: 'address' },
        { model: Payment, as: 'payments' },
      ],
    });

    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    const productIds = ((order as unknown as { items: OrderItem[] }).items ?? []).map((i) => i.productId);
    const userReviewsMap = await this.buildUserReviewsMap(userId, productIds);
    const [walletPaidByOrderId, shadowfaxOrderIdByOrderId] = await Promise.all([
      buildWalletPaidByOrderIds([order.id]),
      buildShadowfaxOrderIdByOrderIds([order.id]),
    ]);

    return this.formatOrder(order, userReviewsMap, walletPaidByOrderId, shadowfaxOrderIdByOrderId);
  }

  async getDeliveryStatus(
    orderId: string,
    userId: string,
    role: string,
  ): Promise<ShadowfaxOrderStatusData> {
    return getOrderDeliveryStatus(orderId, { userId, role });
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────────

  async cancelOrder(orderId: string, userId: string) {
    const orderRefWhere = await buildOrderRefWhere(orderId);

    const order = await Order.findOne({
      where: { ...orderRefWhere, userId },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw AppError.badRequest(
        `Cannot cancel order with status "${order.status}"`,
        'ORDER_NOT_CANCELLABLE',
      );
    }

    const wasPendingUnpaid = order.status === 'pending';
    const items = (order as unknown as { items: OrderItem[] }).items ?? [];

    const t = await sequelize.transaction();
    try {
      if (wasPendingUnpaid) {
        await failPendingPaymentsForOrder(order.id, t);
      }

      for (const item of items) {
        if (!item.variantId) continue;

        const variant = await ProductVariant.findByPk(item.variantId, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!variant) {
          logger.warn({ variantId: item.variantId, orderId }, 'Variant not found during cancellation — skipping stock restore');
          continue;
        }

        await variant.update({ stock: variant.stock + item.quantity }, { transaction: t });
      }

      const restockedProductIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
      for (const productId of restockedProductIds) {
        await syncProductStockFromVariants(productId, t);
      }

      await this._refundCapturedPaymentOnCancel(order.id, t);
      await order.update({ status: 'cancelled' }, { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    if (wasPendingUnpaid) {
      notifyPaymentCancelled(userId, order.id);
    } else {
      notifyBuyerOrderStatus(userId, order.id, 'cancelled');
    }

    const shadowfaxOrderIdByOrderId = await buildShadowfaxOrderIdByOrderIds([order.id]);

    return this.formatOrder(order, undefined, undefined, shadowfaxOrderIdByOrderId);
  }

  // ─── Wallet payment ───────────────────────────────────────────────────────────

  async payWithWallet(orderId: string, userId: string) {
    const orderRefWhere = await buildOrderRefWhere(orderId);

    const order = await Order.findOne({
      where: { ...orderRefWhere, userId },
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });

    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    if (order.status !== 'pending') {
      throw AppError.badRequest('Only pending orders can be paid', 'ORDER_NOT_PAYABLE');
    }

    const t = await sequelize.transaction();
    try {
      const wallet = await Wallet.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');
      if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

      const balanceBefore = Number(wallet.balance);
      const totalAmount = Number(order.totalAmount);

      if (balanceBefore < totalAmount) {
        throw AppError.badRequest('Insufficient wallet balance', 'INSUFFICIENT_FUNDS');
      }

      const balanceAfter = parseFloat((balanceBefore - totalAmount).toFixed(2));

      await wallet.update({ balance: balanceAfter }, { transaction: t });

      await WalletTransaction.create(
        {
          walletId: wallet.id,
          reference: `order_${order.id}`,
          type: 'debit',
          amount: totalAmount,
          fee: 0,
          balanceBefore,
          balanceAfter,
          status: 'successful',
          source: 'order_payment',
          provider: null,
          providerReference: null,
          metadata: { orderId: order.id },
        },
        { transaction: t },
      );

      await order.update({ status: 'confirmed' }, { transaction: t });

      await t.commit();

      scheduleShadowfaxPlacementIfDelivery(order);

      notifyUser(userId, NotificationType.WALLET_DEBITED, { amount: totalAmount });
      void notifyOrderPlacedAfterPayment(userId, order.id);
      notifyBuyerOrderStatus(userId, order.id, 'confirmed');

      const [walletPaidByOrderId, shadowfaxOrderIdByOrderId] = await Promise.all([
        buildWalletPaidByOrderIds([order.id]),
        buildShadowfaxOrderIdByOrderIds([order.id]),
      ]);

      return {
        order: this.formatOrder(order, undefined, walletPaidByOrderId, shadowfaxOrderIdByOrderId),
        walletBalance: balanceAfter,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  // ─── Vendor: update order status ─────────────────────────────────────────────

  async updateVendorOrderStatus(orderId: string, vendorId: string, newStatus: string): Promise<ReturnType<typeof this.formatOrder>> {
    const toStatus = normalizeOrderStatusInput(newStatus);

    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const orderRefWhere = await buildOrderRefWhere(orderId);

    const order = await Order.findOne({
      where: orderRefWhere,
      include: [
        {
          model: OrderItem,
          as: 'items',
          required: true,
          include: [
            {
              model: Product,
              as: 'product',
              required: true,
              where: { storeId: store.id },
              attributes: ['id', 'storeId'],
            },
          ],
        },
        { model: Address, as: 'address' },
      ],
    });

    if (!order) throw AppError.forbidden('Order does not contain items from your store', 'ORDER_FORBIDDEN');

    if (toStatus === 'delivered') {
      const t = await sequelize.transaction();
      try {
        const result = await transitionOrderStatus({
          orderId: order.id,
          toStatus: 'delivered',
          source: 'vendor',
          allowManual: true,
          orderPatch: { deliveredAt: new Date() },
          transaction: t,
          skipPublish: true,
        });
        if (!result.applied && result.reason === 'invalid_transition') {
          throw AppError.badRequest(
            `Cannot transition order from "${order.status}" to "${toStatus}"`,
            'INVALID_STATUS_TRANSITION',
          );
        }
        await this._grantReferralReward(order.userId, t);
        await t.commit();
        if (result.applied) {
          await publishOrderStatusChanged({
            orderId: order.id,
            userId: order.userId,
            oldStatus: result.oldStatus,
            newStatus: result.newStatus,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } else if (toStatus === 'cancelled') {
      const t = await sequelize.transaction();
      try {
        await this._refundCapturedPaymentOnCancel(order.id, t);
        const result = await transitionOrderStatus({
          orderId: order.id,
          toStatus: 'cancelled',
          source: 'vendor',
          allowManual: true,
          orderPatch: { cancelledAt: new Date() },
          transaction: t,
          skipPublish: true,
        });
        if (!result.applied && result.reason === 'invalid_transition') {
          throw AppError.badRequest(
            `Cannot transition order from "${order.status}" to "${toStatus}"`,
            'INVALID_STATUS_TRANSITION',
          );
        }
        await t.commit();
        if (result.applied) {
          await publishOrderStatusChanged({
            orderId: order.id,
            userId: order.userId,
            oldStatus: result.oldStatus,
            newStatus: result.newStatus,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } else {
      const result = await transitionOrderStatus({
        orderId: order.id,
        toStatus,
        source: 'vendor',
        allowManual: true,
      });
      if (!result.applied && result.reason === 'invalid_transition') {
        throw AppError.badRequest(
          `Cannot transition order from "${order.status}" to "${toStatus}"`,
          'INVALID_STATUS_TRANSITION',
        );
      }
    }

    await order.reload({
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });

    const shadowfaxOrderIdByOrderId = await buildShadowfaxOrderIdByOrderIds([order.id]);

    return this.formatOrder(order, undefined, undefined, shadowfaxOrderIdByOrderId);
  }

  // ─── Admin: update order status ───────────────────────────────────────────────

  async updateStatus(orderId: string, newStatus: string): Promise<ReturnType<typeof this.formatOrder>> {
    const toStatus = normalizeOrderStatusInput(newStatus);

    const orderRefWhere = await buildOrderRefWhere(orderId);

    const order = await Order.findOne({
      where: orderRefWhere,
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });

    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    if (toStatus === 'delivered') {
      const t = await sequelize.transaction();
      try {
        const result = await transitionOrderStatus({
          orderId: order.id,
          toStatus: 'delivered',
          source: 'admin',
          allowManual: true,
          orderPatch: { deliveredAt: new Date() },
          transaction: t,
          skipPublish: true,
        });
        if (!result.applied && result.reason === 'invalid_transition') {
          throw AppError.badRequest(
            `Cannot transition order from "${order.status}" to "${toStatus}"`,
            'INVALID_STATUS_TRANSITION',
          );
        }
        await this._grantReferralReward(order.userId, t);
        await t.commit();
        if (result.applied) {
          await publishOrderStatusChanged({
            orderId: order.id,
            userId: order.userId,
            oldStatus: result.oldStatus,
            newStatus: result.newStatus,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } else if (toStatus === 'cancelled') {
      const t = await sequelize.transaction();
      try {
        await this._refundCapturedPaymentOnCancel(order.id, t);
        const result = await transitionOrderStatus({
          orderId: order.id,
          toStatus: 'cancelled',
          source: 'admin',
          allowManual: true,
          orderPatch: { cancelledAt: new Date() },
          transaction: t,
          skipPublish: true,
        });
        if (!result.applied && result.reason === 'invalid_transition') {
          throw AppError.badRequest(
            `Cannot transition order from "${order.status}" to "${toStatus}"`,
            'INVALID_STATUS_TRANSITION',
          );
        }
        await t.commit();
        if (result.applied) {
          await publishOrderStatusChanged({
            orderId: order.id,
            userId: order.userId,
            oldStatus: result.oldStatus,
            newStatus: result.newStatus,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } else {
      const result = await transitionOrderStatus({
        orderId: order.id,
        toStatus,
        source: 'admin',
        allowManual: true,
      });
      if (!result.applied && result.reason === 'invalid_transition') {
        throw AppError.badRequest(
          `Cannot transition order from "${order.status}" to "${toStatus}"`,
          'INVALID_STATUS_TRANSITION',
        );
      }
    }

    await order.reload({
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });

    const shadowfaxOrderIdByOrderId = await buildShadowfaxOrderIdByOrderIds([order.id]);

    return this.formatOrder(order, undefined, undefined, shadowfaxOrderIdByOrderId);
  }

  // ─── Cancellation refund (private) ────────────────────────────────────────────

  /**
   * Credits the customer's wallet for the full `order.totalAmount` once (store credit;
   * no Razorpay refund API). Covers Razorpay-only, full-wallet, partial-wallet, and
   * pay-with-wallet flows — all use `orders.total_amount` as the source of truth.
   *
   * Skips wallet credit when the order is still `pending` (never paid).
   * Idempotent via WalletTransaction reference `refund_cancel_${orderId}`.
   * Marks every `Payment` row still in `captured` as `refunded` after a successful
   * wallet credit, or when the refund transaction already exists (cleanup).
   */
  private async _refundCapturedPaymentOnCancel(orderId: string, t: Transaction): Promise<void> {
    const order = await Order.findOne({
      where: { id: orderId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!order) return;

    if (order.status === 'pending') {
      return;
    }

    const reference = `refund_cancel_${orderId}`;

    const markAllCapturedPaymentsRefunded = async (): Promise<void> => {
      await Payment.update(
        {
          status: 'refunded',
          refundProcessedAt: new Date(),
        },
        { where: { orderId, status: 'captured' }, transaction: t },
      );
    };

    const existingRefund = await WalletTransaction.findOne({
      where: { reference },
      transaction: t,
    });
    if (existingRefund) {
      await markAllCapturedPaymentsRefunded();
      return;
    }

    const refundAmount = parseFloat(Number(order.totalAmount).toFixed(2));
    if (refundAmount <= 0) {
      return;
    }

    const wallet = await Wallet.findOne({
      where: { userId: order.userId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!wallet || !wallet.isActive) {
      logger.warn(
        { orderId, userId: order.userId },
        'Cannot refund cancelled order — wallet missing or inactive; leaving payments unchanged',
      );
      return;
    }

    const capturedPayments = await Payment.findAll({
      where: { orderId, status: 'captured' },
      attributes: ['id'],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = parseFloat((balanceBefore + refundAmount).toFixed(2));

    await wallet.update({ balance: balanceAfter }, { transaction: t });

    await WalletTransaction.create(
      {
        walletId: wallet.id,
        reference,
        type: 'credit',
        amount: refundAmount,
        fee: 0,
        balanceBefore,
        balanceAfter,
        status: 'successful',
        source: 'refund',
        provider: null,
        providerReference: null,
        metadata: {
          orderId,
          reason: 'order_cancel',
          paymentIds: capturedPayments.map((p) => p.id),
        },
      },
      { transaction: t },
    );

    await markAllCapturedPaymentsRefunded();
  }

  // ─── Referral reward (private) ────────────────────────────────────────────────

  private async _grantReferralReward(userId: string, t: Transaction): Promise<void> {
    // Only trigger on first completed order
    const deliveredCount = await Order.count({
      where: { userId, status: 'delivered' },
      transaction: t,
    });
    if (deliveredCount > 1) return; // not first

    const user = await User.findByPk(userId, { transaction: t });
    if (!user || !user.referredById) return;

    // Self-referral guard
    if (user.referredById === userId) return;

    const rewardAmount = REFERRAL_REWARD_AMOUNT;

    // Credit referred user
    await this._creditWallet(
      userId,
      `referral_referred_${userId}`,
      rewardAmount,
      { reason: 'Referral reward — you were referred', referrerId: user.referredById },
      t,
    );

    // Credit referrer
    await this._creditWallet(
      user.referredById,
      `referral_referrer_${userId}`,
      rewardAmount,
      { reason: 'Referral reward — your referral placed their first order', referredUserId: userId },
      t,
    );

    notifyUser(userId, NotificationType.REFERRAL_REWARD_CREDITED, { amount: rewardAmount });
    notifyUser(user.referredById, NotificationType.REFERRAL_REWARD_CREDITED, { amount: rewardAmount });
  }

  private async _creditWallet(
    userId: string,
    reference: string,
    amount: number,
    metadata: object,
    t: Transaction,
  ): Promise<void> {
    const wallet = await Wallet.findOne({
      where: { userId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!wallet || !wallet.isActive) return;

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = parseFloat((balanceBefore + amount).toFixed(2));

    await wallet.update({ balance: balanceAfter }, { transaction: t });

    // Unique reference enforces idempotency at the DB level
    await WalletTransaction.create(
      {
        walletId: wallet.id,
        reference,
        type: 'credit',
        amount,
        fee: 0,
        balanceBefore,
        balanceAfter,
        status: 'successful',
        source: 'referral_reward',
        provider: null,
        providerReference: null,
        metadata,
      },
      { transaction: t },
    );
  }

  private formatVariantForOrderItem(
    variant: ProductVariant & { color?: ProductColor & { images?: ProductColorImage[] } },
    resolvedImageUrl: string | null,
  ): Record<string, unknown> | null {
    if (!variant) return null;

    const variantJson = variant.toPublicJSON() as Record<string, unknown>;
    const colorModel = variant.color;

    if (colorModel) {
      const sortedImages = [...(colorModel.images ?? [])].sort(
        (a, b) => Number(a.displayOrder) - Number(b.displayOrder),
      );
      variantJson.color = {
        ...colorModel.toPublicJSON(),
        images: sortedImages.map((img) => img.toPublicJSON()),
      };
    } else {
      variantJson.color = null;
    }

    variantJson.imageUrl = resolvedImageUrl;
    return variantJson;
  }

  /** Current user's product review per productId (for order line items). */
  private async buildUserReviewsMap(
    userId: string,
    productIds: string[],
  ): Promise<Map<string, OrderLineItemMyReview | null>> {
    if (!productIds.length) return new Map();
    const reviews = await ProductReview.findAll({
      where: { userId, productId: { [Op.in]: productIds } },
      attributes: ['id', 'productId', 'rating', 'comment', 'createdAt'],
      include: [{ model: ProductReviewImage, as: 'images' }],
    });
    return new Map(
      reviews.map((r) => {
        const reviewImages = ((r as unknown as { images?: ProductReviewImage[] }).images ?? []).map(
          (img) => img.toPublicJSON(),
        );
        return [
          r.productId,
          {
            id: r.id,
            rating: Number(r.rating),
            comment: r.comment ?? null,
            createdAt: r.createdAt?.toISOString?.() ?? null,
            images: reviewImages,
          },
        ];
      }),
    );
  }

  private formatOrderCustomer(user: User) {
    return {
      id: user.id,
      name: user.name ?? null,
      phone: user.phone ?? null,
      email: user.email ?? null,
      profileImage: user.profileImage ?? null,
    };
  }

  private formatOrder(
    order: Order,
    userReviewsMap?: Map<string, OrderLineItemMyReview | null>,
    walletPaidByOrderId?: Map<string, number>,
    shadowfaxOrderIdByOrderId?: Map<string, string | null>,
  ) {
    const items = ((order as unknown as { items: OrderItem[] }).items ?? []).map((i) => {
      const product = (i as any).product as { store?: Store; images?: ProductImage[] } | undefined;
      const variant = (i as any).variant as
        | (ProductVariant & { color?: ProductColor & { images?: ProductColorImage[] } })
        | null;

      let imageUrl: string | null = null;
      if (variant?.color?.images?.length) {
        const sortedColorImages = [...variant.color.images].sort(
          (a, b) => Number(a.displayOrder) - Number(b.displayOrder),
        );
        imageUrl = sortedColorImages[0].imageUrl;
      } else if (product?.images?.length) {
        const sortedImages = [...product.images].sort((a, b) => a.position - b.position);
        imageUrl = sortedImages[0].url;
      }

      const variantJson = variant ? this.formatVariantForOrderItem(variant, imageUrl) : null;

      const myReview = userReviewsMap?.get(i.productId) ?? null;

      return {
        ...i.toPublicJSON(),
        variant: variantJson,
        productImage: imageUrl,
        store: product?.store ? (product.store as Store).toPublicJSON() : null,
        /** @deprecated Prefer `myReview.rating` — kept for backward compatibility. */
        userRating: myReview?.rating ?? null,
        myReview,
      };
    });
    const address = (order as unknown as { address: Address | null }).address;
    const payments = ((order as any).payments as Payment[] ?? []).map((p) => p.toPublicJSON());

    // Pick the latest captured payment to surface paymentType at order level
    const capturedPayment = payments.find((p: any) => p.status === 'captured');
    const walletAmountPaid = resolveWalletAmountPaid(order.id, payments, walletPaidByOrderId);

    const publicOrder = order.toPublicJSON();
    const deliveryWaivedReason = resolveDeliveryWaivedReason({
      deliveryType: order.deliveryType,
      deliveryCharge: Number(publicOrder.deliveryCharge),
      couponCode: publicOrder.couponCode as string | null,
    });

    return {
      ...publicOrder,
      items,
      address: address ? address.toPublicJSON() : null,
      paymentType: capturedPayment?.paymentType ?? null,
      walletAmountPaid,
      shadowfaxOrderId:
        publicOrder.shadowfaxOrderId ??
        resolveShadowfaxOrderId(order.id, shadowfaxOrderIdByOrderId),
      payments,
      deliveryWaivedReason,
      deliveryConfig: getPublicDeliveryConfig(),
    };
  }
}

export default new OrderService();
