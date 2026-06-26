import type { Transaction } from 'sequelize';
import sequelize from '@config/database';
import Order, { type OrderStatus } from '@modules/order/order.model';
import logger from '@utils/logger';
import { canManualTransition, canShadowfaxTransition, canTransition } from './order-status.fsm';
import { appendOrderStatusHistory } from './order-status-history.repository';
import { publishOrderStatusChanged } from './order-status.publisher';
import type { OrderStatusSource } from './shadowfax-webhook.types';

export interface TransitionOrderStatusInput {
  orderId: string;
  toStatus: OrderStatus;
  source: OrderStatusSource;
  payload?: object | null;
  remarks?: string | null;
  orderPatch?: Partial<{
    deliveredAt: Date | null;
    cancelledAt: Date | null;
    returnedAt: Date | null;
    riderId: number | null;
    riderName: string | null;
    riderPhone: string | null;
    shadowfaxOrderId: number | null;
    shadowfaxTrackingUrl: string | null;
    deliveryMetadata: object | null;
  }>;
  allowManual?: boolean;
  transaction?: Transaction;
  skipPublish?: boolean;
}

export interface TransitionOrderStatusResult {
  applied: boolean;
  order: Order;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
}

export async function transitionOrderStatus(
  input: TransitionOrderStatusInput,
): Promise<TransitionOrderStatusResult> {
  const run = async (t: Transaction) => {
    const order = await Order.findByPk(input.orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');

    const oldStatus = order.status;
    const toStatus = input.toStatus;

    if (oldStatus === toStatus) {
      if (input.orderPatch) {
        await order.update(input.orderPatch as Record<string, unknown>, { transaction: t });
      }
      return {
        applied: false,
        order,
        oldStatus,
        newStatus: toStatus,
        reason: 'no_op_same_status',
      };
    }

    const isShadowfaxSource = input.source.startsWith('shadowfax_');
    const allowed = isShadowfaxSource
      ? canShadowfaxTransition(oldStatus, toStatus)
      : input.allowManual
        ? canManualTransition(oldStatus, toStatus)
        : canTransition(oldStatus, toStatus);

    if (!allowed) {
      logger.warn(
        { orderId: input.orderId, oldStatus, toStatus, source: input.source },
        'invalid_transition',
      );
      return {
        applied: false,
        order,
        oldStatus,
        newStatus: oldStatus,
        reason: 'invalid_transition',
      };
    }

    const patch: Record<string, unknown> = { status: toStatus, ...(input.orderPatch ?? {}) };
    await order.update(patch, { transaction: t });

    await appendOrderStatusHistory({
      orderId: order.id,
      oldStatus,
      newStatus: toStatus,
      source: input.source,
      remarks: input.remarks ?? null,
      payload: input.payload ?? null,
      transaction: t,
    });

    return { applied: true, order, oldStatus, newStatus: toStatus };
  };

  const result = input.transaction
    ? await run(input.transaction)
    : await sequelize.transaction(run);

  if (result.applied && !input.skipPublish && !input.transaction) {
    await publishOrderStatusChanged({
      orderId: result.order.id,
      userId: result.order.userId,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}
