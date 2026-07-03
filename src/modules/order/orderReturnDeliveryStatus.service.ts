import ShadowfaxReturnShipment from '@modules/shadowfax/shadowfax-return-shipment.model';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import { fetchAndSyncShadowfaxReturnDeliveryStatus } from '@modules/shadowfax/tracking/order-return-shadowfax.processor';
import { AppError } from '@utils/appError';
import { buildOrderRefWhere } from './orderRef';
import { findOrderForCaller, type OrderCaller } from './orderCallerAccess';
import OrderReturn from './order-return.model';

export type ReturnDeliveryStatusCaller = OrderCaller;

export async function getOrderReturnDeliveryStatus(
  orderRef: string,
  returnId: string,
  caller: ReturnDeliveryStatusCaller,
): Promise<ShadowfaxOrderStatusData> {
  const orderRefWhere = await buildOrderRefWhere(orderRef);

  const order = await findOrderForCaller(orderRefWhere, caller, {
    attributes: ['id', 'deliveryType'],
  });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

  if (order.deliveryType !== 'delivery') {
    throw AppError.badRequest(
      'Return delivery status is only available for delivery orders',
      'DELIVERY_STATUS_NOT_APPLICABLE',
    );
  }

  const orderReturn = await OrderReturn.findOne({
    where: { id: returnId, orderId: order.id },
  });
  if (!orderReturn) throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');

  const shipment = await ShadowfaxReturnShipment.findOne({ where: { orderReturnId: returnId } });
  if (!shipment || shipment.status !== 'placed' || !shipment.shadowfaxOrderId) {
    throw AppError.conflict(
      'Shadowfax return pickup has not been placed yet. Try again shortly.',
      'SHADOWFAX_RETURN_NOT_PLACED',
    );
  }

  const status = await fetchAndSyncShadowfaxReturnDeliveryStatus(returnId);

  if (!status) {
    throw AppError.conflict(
      'Shadowfax return pickup has not been placed yet. Try again shortly.',
      'SHADOWFAX_RETURN_NOT_PLACED',
    );
  }

  return status;
}
