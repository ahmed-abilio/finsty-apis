import { Op } from 'sequelize';
import OrderReturn, { ACTIVE_ORDER_RETURN_STATUSES } from './order-return.model';

export type ActiveReturnSummary = {
  id: string;
  shadowfaxOrderId: string | null;
};

/** Active return summaries keyed by Finsty order UUID. Missing orders map to `null`. */
export async function buildActiveReturnByOrderIds(
  orderIds: string[],
): Promise<Map<string, ActiveReturnSummary | null>> {
  const map = new Map<string, ActiveReturnSummary | null>();
  if (!orderIds.length) return map;

  for (const id of orderIds) {
    map.set(id, null);
  }

  const rows = await OrderReturn.findAll({
    where: {
      orderId: { [Op.in]: orderIds },
      status: { [Op.in]: ACTIVE_ORDER_RETURN_STATUSES },
    },
    attributes: ['id', 'orderId', 'shadowfaxOrderId', 'requestedAt'],
    order: [['requestedAt', 'DESC']],
  });

  for (const row of rows) {
    if (map.get(row.orderId) != null) continue;
    map.set(row.orderId, {
      id: row.id,
      shadowfaxOrderId: row.shadowfaxOrderId ?? null,
    });
  }

  return map;
}

export function resolveActiveReturn(
  orderId: string,
  activeReturnByOrderId?: Map<string, ActiveReturnSummary | null>,
): ActiveReturnSummary | null {
  if (!activeReturnByOrderId?.has(orderId)) return null;
  return activeReturnByOrderId.get(orderId) ?? null;
}
