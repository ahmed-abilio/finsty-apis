import type Order from './order.model';
import OrderReturnItem from './order-return-item.model';
import OrderReturn, { ACTIVE_ORDER_RETURN_STATUSES } from './order-return.model';
import { Op } from 'sequelize';

export const RETURN_WINDOW_MS = 60 * 60 * 1000;

export function isWithinReturnWindow(deliveredAt: Date | null, now = Date.now()): boolean {
  if (!deliveredAt) return false;
  return now - deliveredAt.getTime() <= RETURN_WINDOW_MS;
}

export function assertReturnEligible(order: Order): void {
  if (order.deliveryType !== 'delivery') {
    throw new Error('RETURN_NOT_ELIGIBLE');
  }
  if (order.status !== 'delivered') {
    throw new Error('RETURN_NOT_ELIGIBLE');
  }
  if (!isWithinReturnWindow(order.deliveredAt)) {
    throw new Error('RETURN_WINDOW_EXPIRED');
  }
}

export function computeLineRefundAmount(unitPrice: number, quantity: number): number {
  return parseFloat((Number(unitPrice) * quantity).toFixed(2));
}

export async function getReturnedQuantityByOrderItemIds(
  orderItemIds: string[],
): Promise<Map<string, number>> {
  if (!orderItemIds.length) return new Map();

  const rows = await OrderReturnItem.findAll({
    attributes: ['orderItemId', 'quantity'],
    include: [
      {
        model: OrderReturn,
        as: 'orderReturn',
        attributes: [],
        where: {
          status: {
            [Op.in]: [...ACTIVE_ORDER_RETURN_STATUSES, 'refund_approved'],
          },
        },
        required: true,
      },
    ],
    where: { orderItemId: { [Op.in]: orderItemIds } },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.orderItemId, (map.get(row.orderItemId) ?? 0) + row.quantity);
  }
  return map;
}

export function mapShadowfaxStatusToReturnLogistics(
  shadowfaxStatus: string,
): import('./order-return.model').OrderReturnLogisticsStatus | null {
  const key = shadowfaxStatus?.trim().toUpperCase();
  const mapping: Record<string, import('./order-return.model').OrderReturnLogisticsStatus> = {
    ALLOTTED: 'rider_assigned',
    ARRIVED: 'at_store',
    DISPATCHED: 'picked_up',
    ARRIVED_CUSTOMER_DOORSTEP: 'arrived',
    DELIVERED: 'delivered',
  };
  return mapping[key] ?? null;
}

export function mapLogisticsToReturnStatus(
  logistics: import('./order-return.model').OrderReturnLogisticsStatus,
): import('./order-return.model').OrderReturnStatus {
  if (logistics === 'delivered') return 'pending_inspection';
  if (logistics === 'pickup_scheduled') return 'pickup_scheduled';
  return logistics;
}
