import type { WhereOptions } from 'sequelize';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_ORDER_ID_REGEX = /^FI[A-Z0-9]{6}\d{3}[A-Z0-9]$/;

/**
 * Maps a client order reference to a safe `orders` where clause.
 * Accepts Finsty UUID, public `FI…` code, or Shadowfax order id.
 */
export async function buildOrderRefWhere(orderRef: string): Promise<WhereOptions> {
  if (UUID_REGEX.test(orderRef)) {
    return { id: orderRef };
  }

  if (PUBLIC_ORDER_ID_REGEX.test(orderRef)) {
    return { orderId: orderRef };
  }

  const shipment = await ShadowfaxShipment.findOne({
    where: { shadowfaxOrderId: orderRef },
    attributes: ['orderId'],
  });
  if (shipment) {
    return { id: shipment.orderId };
  }

  return { orderId: orderRef };
}
