import Order from '@modules/order/order.model';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';

/**
 * Resolve Finsty order by Shadowfax client_order_id (our order UUID).
 * Falls back via shadowfax_shipments when sfx id is present in payload.
 */
export async function resolveOrderByClientOrderId(
  clientOrderId: string,
  sfxOrderId?: number | null,
): Promise<Order | null> {
  const byId = await Order.findByPk(clientOrderId);
  if (byId) return byId;

  if (sfxOrderId != null) {
    const shipment = await ShadowfaxShipment.findOne({
      where: { shadowfaxOrderId: String(sfxOrderId) },
    });
    if (shipment) {
      return Order.findByPk(shipment.orderId);
    }
  }

  return null;
}
