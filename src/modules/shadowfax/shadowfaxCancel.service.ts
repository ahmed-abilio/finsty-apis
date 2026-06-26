import Order from '@modules/order/order.model';
import logger from '@utils/logger';
import shadowfaxClient from './shadowfax.client';
import type { ShadowfaxCancelOrderRequest } from './shadowfaxCancel.types';
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

/**
 * Best-effort Shadowfax cancel for a placed delivery order.
 * Logs and swallows upstream errors so local cancellation can still complete.
 */
export async function cancelShadowfaxOrderForFinstyOrder(
  orderId: string,
  input: ShadowfaxCancelOrderRequest,
): Promise<void> {
  const order = await Order.findByPk(orderId, { attributes: ['deliveryType'] });
  if (!order || order.deliveryType !== 'delivery') {
    return;
  }

  const shadowfaxOrderId = await resolvePlacedShadowfaxOrderId(orderId);
  if (!shadowfaxOrderId) {
    return;
  }

  try {
    await shadowfaxClient.cancelOrder(shadowfaxOrderId, input);
    logger.info({ orderId, shadowfaxOrderId, user: input.user }, 'Shadowfax order cancelled');
  } catch (err) {
    logger.warn(
      { err, orderId, shadowfaxOrderId, user: input.user },
      'Shadowfax order cancel failed; proceeding with local cancel',
    );
  }
}
