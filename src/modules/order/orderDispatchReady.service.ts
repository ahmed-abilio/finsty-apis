import Order from './order.model';
import { markShadowfaxDispatchReadyForFinstyOrder } from '@modules/shadowfax/shadowfaxDispatchReady.service';
import type { ShadowfaxDispatchReadyRequest } from '@modules/shadowfax/shadowfaxDispatchReady.types';

/**
 * Notifies Shadowfax dispatch-ready and persists `isDispatchReady` on the order.
 * Idempotent when the flag is already true.
 */
export async function applyOrderDispatchReady(
  orderId: string,
  body: ShadowfaxDispatchReadyRequest,
): Promise<unknown> {
  const order = await Order.findByPk(orderId, { attributes: ['id', 'isDispatchReady'] });
  if (!order) {
    return { message: 'Order not found' };
  }

  if (order.isDispatchReady) {
    return { message: 'Already dispatch-ready' };
  }

  const data = await markShadowfaxDispatchReadyForFinstyOrder(orderId, body);
  await order.update({ isDispatchReady: true });
  return data;
}
