import { Op } from 'sequelize';
import OrderStatusHistory from '@modules/shadowfax/tracking/order-status-history.model';

export interface OrderStatusEvent {
  status: string;
  occurredAt: string;
  source: string;
}

/** Chronological status transition events keyed by Finsty order UUID. Missing orders map to `[]`. */
export async function buildOrderStatusHistoryByOrderIds(
  orderIds: string[],
): Promise<Map<string, OrderStatusEvent[]>> {
  const map = new Map<string, OrderStatusEvent[]>();
  if (!orderIds.length) return map;

  for (const id of orderIds) {
    map.set(id, []);
  }

  const rows = await OrderStatusHistory.findAll({
    where: { orderId: { [Op.in]: orderIds } },
    attributes: ['orderId', 'newStatus', 'source', 'createdAt'],
    order: [
      ['orderId', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });

  for (const row of rows) {
    const events = map.get(row.orderId) ?? [];
    events.push({
      status: row.newStatus,
      occurredAt: row.createdAt.toISOString(),
      source: row.source,
    });
    map.set(row.orderId, events);
  }

  return map;
}
