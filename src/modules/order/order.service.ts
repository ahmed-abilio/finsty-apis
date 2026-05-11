import { Op } from 'sequelize';
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
import ProductColor from '@modules/product/product-color.model';
import ProductColorImage from '@modules/product/product-color-image.model';
import ProductReview from '@modules/product/product-review.model';
import Store from '@modules/store/store.model';
import Payment from '@modules/payment/payment.model';

import cartService from '@modules/cart/cart.service';
import { addCreateOrderJob, OrderItemSnapshot, OrderPricingSnapshot } from '@queues/orderQueue';
import { AppError } from '@utils/appError';
import logger from '@utils/logger';
import type { DeliveryType, OrderStatus } from './order.model';

const TAX_RATE = 0.18;           // 18% GST
const DELIVERY_CHARGE = 49;      // flat ₹49 delivery fee
const FREE_DELIVERY_ABOVE = 499; // free delivery above ₹499 subtotal

const REFERRAL_REWARD_AMOUNT = parseFloat(process.env.REFERRAL_REWARD_AMOUNT ?? '100');

export interface CreateOrderInput {
  addressId?: string;
  deliveryType: DeliveryType;
  notes?: string;
  couponCode?: string;
  autoApply?: boolean;
}

export interface EnqueuedOrderResult {
  /** Use this ID to poll GET /orders/status/:jobId */
  jobId: string;
  message: string;
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
    const { addressId, deliveryType, couponCode, autoApply } = input;

    // ── Fast validation 1: address ───────────────────────────────────────────
    if (deliveryType === 'delivery') {
      if (!addressId) throw AppError.badRequest('Address is required for delivery orders', 'ADDRESS_REQUIRED');
      const address = await Address.findOne({ where: { id: addressId, userId } });
      if (!address) throw AppError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
    }

    // ── Fast validation 2: cart ──────────────────────────────────────────────
    const cartData = await cartService.getCartForOrder(userId);
    if (!cartData) throw AppError.badRequest('Cart is empty', 'EMPTY_CART');

    const { cart, formatted } = cartData;
    const subtotal = formatted.subtotal;

    // ── Determine first-order eligibility (needed for coupon validation) ─────
    const completedOrderCount = await Order.count({ where: { userId, status: 'delivered' } });
    const isFirstOrder = completedOrderCount === 0;

    // ── Coupon resolution ────────────────────────────────────────────────────
    let discountAmount = 0;
    let resolvedCouponCode: string | null = null;
    let deliveryChargeOverride: number | null = null;
    let resolvedCouponId: string | null = null;

    const resolveDiscount = async (code: string) => {
      const result = await couponService.validate(code, { userId, subtotal, isFirstOrder });
      if (result.coupon.type === 'FREE_DELIVERY') {
        deliveryChargeOverride = 0;
      } else {
        discountAmount = result.discountAmount;
      }
      resolvedCouponCode = result.coupon.code;
      return result.coupon;
    };

    if (couponCode) {
      const coupon = await resolveDiscount(couponCode);
      resolvedCouponId = coupon.id;
    } else if (autoApply) {
      const best = await couponService.autoApplyBest({ userId, subtotal, isFirstOrder });
      if (best) {
        if (best.coupon.type === 'FREE_DELIVERY') {
          deliveryChargeOverride = 0;
        } else {
          discountAmount = best.discountAmount;
        }
        resolvedCouponCode = best.coupon.code;
        resolvedCouponId = best.coupon.id;
      }
    }

    // ── Price computation ────────────────────────────────────────────────────
    const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const rawDeliveryCharge =
      deliveryType === 'delivery' && subtotal < FREE_DELIVERY_ABOVE ? DELIVERY_CHARGE : 0;
    const deliveryCharge =
      deliveryChargeOverride !== null ? deliveryChargeOverride : rawDeliveryCharge;
    const totalAmount = parseFloat(
      Math.max(0, subtotal + taxAmount + deliveryCharge - discountAmount).toFixed(2),
    );

    // ── Build order-item snapshots (prices locked at this moment) ─────────────
    const orderItems: OrderItemSnapshot[] = formatted.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      productName: (item.product as { name: string }).name,
      variantLabel: item.variant ? (item.variant as { label: string }).label : null,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.itemTotal,
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
      deliveryCharge,
      totalAmount,
      discountAmount,
      resolvedCouponCode,
      resolvedCouponId,
    };

    // ── Create the PendingOrder tracking record ──────────────────────────────
    const pending = await PendingOrder.create({ userId, status: 'queued' });

    // ── Enqueue the job ───────────────────────────────────────────────────────
    const bullJobId = await addCreateOrderJob(userId, input, pending.id, pricing);

    // Store the BullMQ job ID for debugging / Bull Board visibility
    await pending.update({ jobId: bullJobId });

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
    const userRatingsMap = await this.buildUserRatingsMap(userId, [...new Set(allProductIds)]);

    return {
      orders: rows.map((o) => this.formatOrder(o, userRatingsMap)),
      total: count,
      page,
      limit,
    };
  }

  /**
   * Returns orders that contain items belonging to the vendor's store.
   */
  async listVendorOrders(vendorId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // 1. Find vendor's store
    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    // 2. Find orders containing items for this store
    // We join Order -> OrderItems -> Product to filter by storeId
    const { count, rows } = await Order.findAndCountAll({
      distinct: true,
      include: [
        {
          model: OrderItem,
          as: 'items',
          required: true, // INNER JOIN
          include: [
            {
              model: Product,
              as: 'product',
              required: true,
              where: { storeId: store.id },
              attributes: [], // We don't need product data in the root
              include: [{ model: ProductImage, as: 'images', attributes: [] }], // Only needed if we mapped images here, but actually we need attributes to extract it!
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
    });

    return {
      orders: rows.map((o) => this.formatOrder(o)),
      total: count,
      page,
      limit,
    };
  }

  async getOrderById(orderId: string, userId: string) {
    const order = await Order.findOne({
      where: { id: orderId, userId },
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
    const userRatingsMap = await this.buildUserRatingsMap(userId, productIds);

    return this.formatOrder(order, userRatingsMap);
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────────

  async cancelOrder(orderId: string, userId: string) {
    const order = await Order.findOne({
      where: { id: orderId, userId },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw AppError.badRequest(
        `Cannot cancel order with status "${order.status}"`,
        'ORDER_NOT_CANCELLABLE',
      );
    }

    const items = (order as unknown as { items: OrderItem[] }).items ?? [];

    const t = await sequelize.transaction();
    try {
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

      await order.update({ status: 'cancelled' }, { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    return this.formatOrder(order);
  }

  // ─── Wallet payment ───────────────────────────────────────────────────────────

  async payWithWallet(orderId: string, userId: string) {
    const order = await Order.findOne({
      where: { id: orderId, userId },
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

      return {
        order: this.formatOrder(order),
        walletBalance: balanceAfter,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  // ─── Vendor: update order status ─────────────────────────────────────────────

  async updateVendorOrderStatus(orderId: string, vendorId: string, newStatus: string): Promise<ReturnType<typeof this.formatOrder>> {
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    // Fetch the order only if it contains items from this vendor's store
    const order = await Order.findOne({
      where: { id: orderId },
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

    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw AppError.badRequest(
        `Cannot transition order from "${order.status}" to "${newStatus}"`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    if (newStatus === 'delivered') {
      const t = await sequelize.transaction();
      try {
        await order.update({ status: 'delivered' }, { transaction: t });
        await this._grantReferralReward(order.userId, t);
        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } else {
      await order.update({ status: newStatus as OrderStatus });
    }

    await order.reload({
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });

    return this.formatOrder(order);
  }

  // ─── Admin: update order status ───────────────────────────────────────────────

  async updateStatus(orderId: string, newStatus: string): Promise<ReturnType<typeof this.formatOrder>> {
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    const order = await Order.findOne({
      where: { id: orderId },
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });

    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw AppError.badRequest(
        `Cannot transition order from "${order.status}" to "${newStatus}"`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    if (newStatus === 'delivered') {
      const t = await sequelize.transaction();
      try {
        await order.update({ status: 'delivered' }, { transaction: t });
        await this._grantReferralReward(order.userId, t);
        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } else {
      await order.update({ status: newStatus as OrderStatus });
    }

    // Reload to get fresh state
    await order.reload({
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });

    return this.formatOrder(order);
  }

  // ─── Referral reward (private) ────────────────────────────────────────────────

  private async _grantReferralReward(userId: string, t: import('sequelize').Transaction): Promise<void> {
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
  }

  private async _creditWallet(
    userId: string,
    reference: string,
    amount: number,
    metadata: object,
    t: import('sequelize').Transaction,
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

  private async buildUserRatingsMap(userId: string, productIds: string[]): Promise<Map<string, number | null>> {
    if (!productIds.length) return new Map();
    const reviews = await ProductReview.findAll({
      where: { userId, productId: { [Op.in]: productIds } },
      attributes: ['productId', 'rating'],
    });
    return new Map(reviews.map((r) => [r.productId, r.rating]));
  }

  private formatOrder(order: Order, userRatingsMap?: Map<string, number | null>) {
    const items = ((order as unknown as { items: OrderItem[] }).items ?? []).map((i) => {
      const product = (i as any).product as { store?: Store; images?: ProductImage[] } | undefined;
      const variant = (i as any).variant as (ProductVariant & { color?: { images?: ProductColorImage[] } }) | null;

      let imageUrl: string | null = null;
      if (variant?.color?.images?.length) {
        // Sort by display order
        const sortedColorImages = [...variant.color.images].sort((a, b) => a.displayOrder - b.displayOrder);
        imageUrl = sortedColorImages[0].imageUrl;
      } else if (product?.images?.length) {
        const sortedImages = [...product.images].sort((a, b) => a.position - b.position);
        imageUrl = sortedImages[0].url;
      }

      const variantJson = variant ? variant.toPublicJSON() : null;
      if (variantJson) {
        variantJson.imageUrl = imageUrl;
      }

      return {
        ...i.toPublicJSON(),
        variant: variantJson,
        productImage: imageUrl,
        store: product?.store ? (product.store as Store).toPublicJSON() : null,
        userRating: userRatingsMap?.get(i.productId) ?? null,
      };
    });
    const address = (order as unknown as { address: Address | null }).address;
    const payments = ((order as any).payments as Payment[] ?? []).map((p) => p.toPublicJSON());

    // Pick the latest captured payment to surface paymentType at order level
    const capturedPayment = payments.find((p: any) => p.status === 'captured');

    return {
      ...order.toPublicJSON(),
      items,
      address: address ? address.toPublicJSON() : null,
      paymentType: capturedPayment?.paymentType ?? null,
      payments,
    };
  }
}

export default new OrderService();
