import { Op } from 'sequelize';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';

/** Shadowfax order ids keyed by Finsty order UUID. Missing orders map to `null`. */
export async function buildShadowfaxOrderIdByOrderIds(
  orderIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!orderIds.length) return map;

  for (const id of orderIds) {
    map.set(id, null);
  }

  const shipments = await ShadowfaxShipment.findAll({
    where: { orderId: { [Op.in]: orderIds } },
    attributes: ['orderId', 'shadowfaxOrderId'],
  });

  for (const shipment of shipments) {
    map.set(shipment.orderId, shipment.shadowfaxOrderId ?? null);
  }

  return map;
}

export function resolveShadowfaxOrderId(
  orderId: string,
  shadowfaxOrderIdByOrderId?: Map<string, string | null>,
): string | null {
  if (shadowfaxOrderIdByOrderId?.has(orderId)) {
    return shadowfaxOrderIdByOrderId.get(orderId) ?? null;
  }
  return null;
}
