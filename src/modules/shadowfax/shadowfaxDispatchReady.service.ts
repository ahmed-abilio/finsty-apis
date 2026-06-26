import Order from '@modules/order/order.model';
import { AppError } from '@utils/appError';
import shadowfaxClient from './shadowfax.client';
import type { ShadowfaxDispatchReadyRequest } from './shadowfaxDispatchReady.types';
import ShadowfaxShipment from './shadowfax-shipment.model';

async function resolvePlacedShadowfaxOrderId(orderId: string): Promise<string | null> {
  const shipment = await ShadowfaxShipment.findOne({ where: { orderId } });
  if (shipment?.status === 'placed' && shipment.shadowfaxOrderId) {
    return shipment.shadowfaxOrderId;
  }

  const order = await Order.findByPk(orderId, {
    attributes: ['shadowfaxOrderId', 'deliveryType'],
  });
  if (order?.deliveryType !== 'delivery' || order.shadowfaxOrderId == null) {
    return null;
  }

  return String(order.shadowfaxOrderId);
}

export async function markShadowfaxDispatchReadyForFinstyOrder(
  orderId: string,
  body: ShadowfaxDispatchReadyRequest,
): Promise<unknown> {
  const order = await Order.findByPk(orderId, { attributes: ['deliveryType'] });
  if (!order || order.deliveryType !== 'delivery') {
    throw AppError.badRequest(
      'Dispatch-ready is only available for delivery orders',
      'DELIVERY_STATUS_NOT_APPLICABLE',
    );
  }

  const placed = await resolvePlacedShadowfaxOrderId(orderId);
  if (!placed) {
    throw AppError.conflict(
      'Shadowfax delivery has not been placed yet. Try again shortly after payment is confirmed.',
      'SHADOWFAX_ORDER_NOT_PLACED',
    );
  }

  // Shadowfax dispatch-ready URL uses client_order_id (Finsty order UUID), not sfx_order_id.
  return shadowfaxClient.markDispatchReady(orderId, body);
}
