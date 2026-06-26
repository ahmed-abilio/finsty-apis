import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import { fetchAndSyncShadowfaxDeliveryStatus } from './orderShadowfaxSync.service';
import { AppError } from '@utils/appError';
import { buildOrderRefWhere } from './orderRef';
import { findOrderForCaller, type OrderCaller } from './orderCallerAccess';

export type DeliveryStatusCaller = OrderCaller;

export async function getOrderDeliveryStatus(
  orderRef: string,
  caller: DeliveryStatusCaller,
): Promise<ShadowfaxOrderStatusData> {
  const orderRefWhere = await buildOrderRefWhere(orderRef);

  const order = await findOrderForCaller(orderRefWhere, caller, {
    attributes: ['id', 'deliveryType'],
  });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

  if (order.deliveryType !== 'delivery') {
    throw AppError.badRequest(
      'Delivery status is only available for delivery orders',
      'DELIVERY_STATUS_NOT_APPLICABLE',
    );
  }

  const shipment = await ShadowfaxShipment.findOne({ where: { orderId: order.id } });
  if (!shipment || shipment.status !== 'placed' || !shipment.shadowfaxOrderId) {
    throw AppError.conflict(
      'Shadowfax delivery has not been placed yet. Try again shortly after payment is confirmed.',
      'SHADOWFAX_ORDER_NOT_PLACED',
    );
  }

  const status = await fetchAndSyncShadowfaxDeliveryStatus(order.id);

  if (!status) {
    throw AppError.conflict(
      'Shadowfax delivery has not been placed yet. Try again shortly after payment is confirmed.',
      'SHADOWFAX_ORDER_NOT_PLACED',
    );
  }

  return status;
}
