import Order from '@modules/order/order.model';
import OrderReturn from '@modules/order/order-return.model';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import ShadowfaxReturnShipment from '@modules/shadowfax/shadowfax-return-shipment.model';

/**
 * Resolve Finsty order by Shadowfax client_order_id (our order UUID).
 * Falls back via shadowfax_shipments when sfx id is present in payload.
 */
export async function resolveOrderByClientOrderId(
  clientOrderId: string,
  sfxOrderId?: number | null,
): Promise<Order | null> {
  const returnRow = await OrderReturn.findByPk(clientOrderId);
  if (returnRow) {
    return Order.findByPk(returnRow.orderId);
  }

  const byId = await Order.findByPk(clientOrderId);
  if (byId) return byId;

  if (sfxOrderId != null) {
    const returnShipment = await ShadowfaxReturnShipment.findOne({
      where: { shadowfaxOrderId: String(sfxOrderId) },
    });
    if (returnShipment) {
      const linkedReturn = await OrderReturn.findByPk(returnShipment.orderReturnId);
      if (linkedReturn) return Order.findByPk(linkedReturn.orderId);
    }

    const shipment = await ShadowfaxShipment.findOne({
      where: { shadowfaxOrderId: String(sfxOrderId) },
    });
    if (shipment) {
      return Order.findByPk(shipment.orderId);
    }
  }

  return null;
}

export async function resolveOrderReturnByClientOrderId(
  clientOrderId: string,
  sfxOrderId?: number | null,
): Promise<OrderReturn | null> {
  const byId = await OrderReturn.findByPk(clientOrderId);
  if (byId) return byId;

  if (sfxOrderId != null) {
    const returnShipment = await ShadowfaxReturnShipment.findOne({
      where: { shadowfaxOrderId: String(sfxOrderId) },
    });
    if (returnShipment) {
      return OrderReturn.findByPk(returnShipment.orderReturnId);
    }
  }

  return null;
}
