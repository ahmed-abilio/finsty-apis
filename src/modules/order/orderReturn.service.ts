import { Op, Transaction } from 'sequelize';
import sequelize from '@config/database';
import Order from './order.model';
import OrderItem from './order-item.model';
import OrderReturn, { ACTIVE_ORDER_RETURN_STATUSES } from './order-return.model';
import OrderReturnItem from './order-return-item.model';
import Address from '@modules/address/address.model';
import Product from '@modules/product/product.model';
import ProductVariant from '@modules/product/product-variant.model';
import Store from '@modules/store/store.model';
import Wallet from '@modules/wallet/wallet.model';
import WalletTransaction from '@modules/wallet/wallet-transaction.model';
import { AppError } from '@utils/appError';
import { Roles } from '@modules/user/user.model';
import { findOrderForCaller } from './orderCallerAccess';
import { buildOrderRefWhere } from './orderRef';
import { scheduleShadowfaxReturnPlacement } from '@modules/shadowfax/shadowfaxReturnPlacement.service';
import { syncProductStockFromVariants } from '@modules/product/productStock.util';
import logger from '@utils/logger';
import {
  assertReturnEligible,
  computeLineRefundAmount,
  getReturnedQuantityByOrderItemIds,
} from './orderReturn.utils';
import {
  notifyReturnRefundApproved,
  notifyReturnRefundRejected,
  notifyReturnRequested,
} from '@modules/notification/notification.return';
import { maybeSyncOrderReturnShadowfaxStatusForReturnDetail } from './orderReturnShadowfaxSync.service';

export interface CreateReturnItemInput {
  orderItemId: string;
  quantity: number;
}

export interface CreateReturnInput {
  items: CreateReturnItemInput[];
  reason?: string;
}

class OrderReturnService {
  async createReturn(orderRef: string, userId: string, input: CreateReturnInput) {
    const orderRefWhere = await buildOrderRefWhere(orderRef);
    const order = await findOrderForCaller(orderRefWhere, { userId, role: Roles.USER }, {
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' },
      ],
    });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    try {
      assertReturnEligible(order);
    } catch (err) {
      const code = (err as Error).message;
      if (code === 'RETURN_WINDOW_EXPIRED') {
        throw AppError.badRequest(
          'Return window has expired. Returns are allowed within 1 hour of delivery.',
          'RETURN_WINDOW_EXPIRED',
        );
      }
      throw AppError.badRequest(
        'Order is not eligible for return',
        'RETURN_NOT_ELIGIBLE',
      );
    }

    const items = (order as Order & { items: OrderItem[] }).items ?? [];
    if (!input.items?.length) {
      throw AppError.badRequest('At least one item is required', 'RETURN_ITEMS_REQUIRED');
    }

    const orderItemById = new Map(items.map((item) => [item.id, item]));
    const orderItemIds = input.items.map((i) => i.orderItemId);
    const returnedQtyMap = await getReturnedQuantityByOrderItemIds(orderItemIds);

    const activeOverlap = await OrderReturnItem.findOne({
      include: [
        {
          model: OrderReturn,
          as: 'orderReturn',
          where: {
            status: { [Op.in]: ACTIVE_ORDER_RETURN_STATUSES },
            orderId: order.id,
          },
          required: true,
        },
      ],
      where: { orderItemId: { [Op.in]: orderItemIds } },
    });
    if (activeOverlap) {
      throw AppError.conflict(
        'A return is already in progress for one or more items',
        'RETURN_ALREADY_IN_PROGRESS',
      );
    }

    const firstItem = orderItemById.get(input.items[0].orderItemId);
    if (!firstItem) {
      throw AppError.badRequest('Invalid order item', 'INVALID_ORDER_ITEM');
    }

    const product = await Product.findByPk(firstItem.productId, { attributes: ['id', 'storeId'] });
    if (!product?.storeId) {
      throw AppError.badRequest('Could not resolve store for return', 'RETURN_NOT_ELIGIBLE');
    }

    const storeId = product.storeId;
    const lineRows: Array<{
      orderItemId: string;
      quantity: number;
      unitPrice: number;
      refundAmount: number;
    }> = [];

    for (const line of input.items) {
      const orderItem = orderItemById.get(line.orderItemId);
      if (!orderItem) {
        throw AppError.badRequest('Invalid order item', 'INVALID_ORDER_ITEM');
      }

      const lineProduct = await Product.findByPk(orderItem.productId, { attributes: ['storeId'] });
      if (lineProduct?.storeId !== storeId) {
        throw AppError.badRequest('All return items must be from the same store', 'MULTI_STORE_RETURN');
      }

      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw AppError.badRequest('Invalid return quantity', 'INVALID_RETURN_QUANTITY');
      }

      const alreadyReturned = returnedQtyMap.get(line.orderItemId) ?? 0;
      const returnable = orderItem.quantity - alreadyReturned;
      if (qty > returnable) {
        throw AppError.badRequest(
          `Return quantity exceeds returnable amount for item ${line.orderItemId}`,
          'RETURN_QUANTITY_EXCEEDED',
        );
      }

      lineRows.push({
        orderItemId: line.orderItemId,
        quantity: qty,
        unitPrice: Number(orderItem.unitPrice),
        refundAmount: computeLineRefundAmount(Number(orderItem.unitPrice), qty),
      });
    }

    const t = await sequelize.transaction();
    try {
      const orderReturn = await OrderReturn.create(
        {
          orderId: order.id,
          userId: order.userId,
          storeId,
          status: 'requested',
          logisticsStatus: 'requested',
          reason: input.reason?.trim() || null,
          requestedAt: new Date(),
        },
        { transaction: t },
      );

      for (const row of lineRows) {
        await OrderReturnItem.create(
          {
            orderReturnId: orderReturn.id,
            orderItemId: row.orderItemId,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            refundAmount: row.refundAmount,
          },
          { transaction: t },
        );
      }

      await t.commit();

      scheduleShadowfaxReturnPlacement(orderReturn.id);
      notifyReturnRequested(order.userId, order.id, orderReturn.id);

      return this.getReturn(order.id, orderReturn.id, userId, Roles.USER);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  async listReturnsForOrder(orderRef: string, callerId: string, role: string) {
    const orderRefWhere = await buildOrderRefWhere(orderRef);
    const order = await findOrderForCaller(orderRefWhere, { userId: callerId, role });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    if (order.deliveryType === 'delivery') {
      const returnStubs = await OrderReturn.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'status'],
      });
      await Promise.all(
        returnStubs.map((stub) =>
          maybeSyncOrderReturnShadowfaxStatusForReturnDetail(
            stub.id,
            order.deliveryType,
            stub.status,
          ),
        ),
      );
    }

    const returns = await OrderReturn.findAll({
      where: { orderId: order.id },
      include: [{ model: OrderReturnItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
    });

    return returns.map((r) => this.formatReturn(r));
  }

  async getReturn(orderRef: string, returnId: string, callerId: string, role: string) {
    const orderRefWhere = await buildOrderRefWhere(orderRef);
    const order = await findOrderForCaller(orderRefWhere, { userId: callerId, role });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    const returnStub = await OrderReturn.findOne({
      where: { id: returnId, orderId: order.id },
      attributes: ['id', 'status', 'userId', 'storeId'],
    });
    if (!returnStub) throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');

    if (role === Roles.USER && returnStub.userId !== callerId) {
      throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');
    }

    if (role === Roles.VENDOR) {
      const store = await Store.findOne({ where: { ownerId: callerId } });
      if (!store || store.id !== returnStub.storeId) {
        throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');
      }
    }

    await maybeSyncOrderReturnShadowfaxStatusForReturnDetail(
      returnStub.id,
      order.deliveryType,
      returnStub.status,
    );

    const orderReturn = await this.loadReturn(returnId);
    return this.formatReturn(orderReturn);
  }

  async listVendorReturns(
    vendorId: string,
    status?: string,
    page = 1,
    limit = 20,
  ) {
    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const where: Record<string, unknown> = { storeId: store.id };
    if (status) where.status = status;

    const offset = (page - 1) * limit;
    const { count, rows } = await OrderReturn.findAndCountAll({
      where,
      include: [
        { model: OrderReturnItem, as: 'items' },
        { model: Order, as: 'order', attributes: ['id', 'orderId', 'status', 'deliveredAt'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      returns: rows.map((r) => this.formatReturn(r)),
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async approveReturn(returnId: string, vendorUserId: string) {
    const store = await Store.findOne({ where: { ownerId: vendorUserId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const orderReturn = await OrderReturn.findOne({
      where: { id: returnId, storeId: store.id },
      include: [{ model: OrderReturnItem, as: 'items' }],
    });
    if (!orderReturn) throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');

    if (orderReturn.status !== 'pending_inspection') {
      throw AppError.badRequest(
        'Return is not ready for inspection',
        'RETURN_NOT_READY_FOR_INSPECTION',
      );
    }

    const refundAmount = parseFloat(
      (orderReturn as OrderReturn & { items: OrderReturnItem[] }).items
        .reduce((sum, item) => sum + Number(item.refundAmount), 0)
        .toFixed(2),
    );

    const t = await sequelize.transaction();
    try {
      await this._creditWalletForReturn(orderReturn, refundAmount, t);
      await this._restoreStockForReturn(orderReturn, t);

      await orderReturn.update(
        {
          status: 'refund_approved',
          refundAmount,
          inspectedAt: new Date(),
          refundProcessedAt: new Date(),
        },
        { transaction: t },
      );

      await t.commit();

      notifyReturnRefundApproved(orderReturn.userId, orderReturn.orderId, returnId, refundAmount);

      return this.formatReturn(await this.loadReturn(returnId));
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  async rejectReturn(returnId: string, vendorUserId: string, reason?: string) {
    const store = await Store.findOne({ where: { ownerId: vendorUserId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const orderReturn = await OrderReturn.findOne({
      where: { id: returnId, storeId: store.id },
    });
    if (!orderReturn) throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');

    if (orderReturn.status !== 'pending_inspection') {
      throw AppError.badRequest(
        'Return is not ready for inspection',
        'RETURN_NOT_READY_FOR_INSPECTION',
      );
    }

    await orderReturn.update({
      status: 'refund_rejected',
      rejectionReason: reason?.trim() || null,
      inspectedAt: new Date(),
    });

    notifyReturnRefundRejected(orderReturn.userId, orderReturn.orderId, returnId, reason);

    return this.formatReturn(await this.loadReturn(returnId));
  }

  private async loadReturn(returnId: string): Promise<OrderReturn> {
    const orderReturn = await OrderReturn.findByPk(returnId, {
      include: [{ model: OrderReturnItem, as: 'items' }],
    });
    if (!orderReturn) throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');
    return orderReturn;
  }

  private async _creditWalletForReturn(
    orderReturn: OrderReturn,
    refundAmount: number,
    t: Transaction,
  ): Promise<void> {
    if (refundAmount <= 0) return;

    const reference = `refund_return_${orderReturn.id}`;
    const existingRefund = await WalletTransaction.findOne({
      where: { reference },
      transaction: t,
    });
    if (existingRefund) return;

    const wallet = await Wallet.findOne({
      where: { userId: orderReturn.userId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!wallet || !wallet.isActive) {
      logger.warn(
        { returnId: orderReturn.id, userId: orderReturn.userId },
        'Cannot refund return — wallet missing or inactive',
      );
      throw AppError.conflict('Customer wallet is not available for refund', 'WALLET_UNAVAILABLE');
    }

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
          orderId: orderReturn.orderId,
          returnId: orderReturn.id,
          reason: 'order_return_approved',
        },
      },
      { transaction: t },
    );
  }

  private async _restoreStockForReturn(orderReturn: OrderReturn, t: Transaction): Promise<void> {
    const returnItems = await OrderReturnItem.findAll({
      where: { orderReturnId: orderReturn.id },
      include: [{ model: OrderItem, as: 'orderItem' }],
      transaction: t,
    });

    const restockedProductIds = new Set<string>();

    for (const row of returnItems) {
      const orderItem = (row as OrderReturnItem & { orderItem: OrderItem }).orderItem;
      if (!orderItem?.variantId) continue;

      const variant = await ProductVariant.findByPk(orderItem.variantId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!variant) {
        logger.warn(
          { variantId: orderItem.variantId, returnId: orderReturn.id },
          'Variant not found during return — skipping stock restore',
        );
        continue;
      }

      await variant.update({ stock: variant.stock + row.quantity }, { transaction: t });
      restockedProductIds.add(orderItem.productId);
    }

    for (const productId of restockedProductIds) {
      await syncProductStockFromVariants(productId, t);
    }
  }

  formatReturn(orderReturn: OrderReturn): Record<string, unknown> {
    const items =
      (orderReturn as OrderReturn & { items?: OrderReturnItem[] }).items?.map((i) => i.toPublicJSON()) ??
      [];

    return {
      ...orderReturn.toPublicJSON(),
      items,
    };
  }
}

const orderReturnService = new OrderReturnService();
export default orderReturnService;
