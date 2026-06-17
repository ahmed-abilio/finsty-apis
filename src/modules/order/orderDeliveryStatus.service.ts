import { Op, type WhereOptions } from 'sequelize';
import sequelize from '@config/database';
import Order from './order.model';
import Store from '@modules/store/store.model';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import { syncOrderFromShadowfaxStatusIfDevCallbackEnabled } from '@modules/shadowfax/tracking/shadowfax-dev-local-callback.service';
import { AppError } from '@utils/appError';
import { buildOrderRefWhere } from './orderRef';

export interface DeliveryStatusCaller {
  userId: string;
  role: string;
}

async function findOrderForDeliveryStatus(
  orderRefWhere: WhereOptions,
  caller: DeliveryStatusCaller,
): Promise<Pick<Order, 'id' | 'deliveryType'> | null> {
  const attributes = ['id', 'deliveryType'] as const;

  if (caller.role === 'admin') {
    return Order.findOne({ where: orderRefWhere, attributes: [...attributes] });
  }

  if (caller.role === 'vendor') {
    const store = await Store.findOne({ where: { ownerId: caller.userId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const storeOrderIds = sequelize.literal(
      `(SELECT DISTINCT oi.order_id FROM order_items oi INNER JOIN products p ON p.id = oi.product_id WHERE p.store_id = ${sequelize.escape(store.id)})`,
    );

    return Order.findOne({
      where: {
        [Op.and]: [orderRefWhere, { id: { [Op.in]: storeOrderIds } }],
      },
      attributes: [...attributes],
    });
  }

  return Order.findOne({
    where: { ...orderRefWhere, userId: caller.userId },
    attributes: [...attributes],
  });
}

export async function getOrderDeliveryStatus(
  orderRef: string,
  caller: DeliveryStatusCaller,
): Promise<ShadowfaxOrderStatusData> {
  const orderRefWhere = await buildOrderRefWhere(orderRef);

  const order = await findOrderForDeliveryStatus(orderRefWhere, caller);
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

  const status = await shadowfaxStatusService.fetchOrderStatus(shipment.shadowfaxOrderId);

  if (!status.track_url && shipment.trackUrl) {
    status.track_url = shipment.trackUrl;
  }

  await syncOrderFromShadowfaxStatusIfDevCallbackEnabled(order.id, status);

  return status;
}
