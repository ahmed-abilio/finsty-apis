import Order from '@modules/order/order.model';
import OrderItem from '@modules/order/order-item.model';
import OrderReturn from '@modules/order/order-return.model';
import OrderReturnItem from '@modules/order/order-return-item.model';
import Address from '@modules/address/address.model';
import Store from '@modules/store/store.model';
import ShadowfaxReturnShipment from './shadowfax-return-shipment.model';
import shadowfaxClient from './shadowfax.client';
import { tryGetShadowfaxClientCode } from './shadowfax.config';
import {
  buildReturnPlaceOrderPayload,
  getShadowfaxReplayFromOrder,
  parsePlaceOrderResponse,
} from './shadowfaxPlaceOrder';
import { enqueueShadowfaxReturnPlacementJob } from '@queues/shadowfaxQueue';
import logger from '@utils/logger';
import { AppError } from '@utils/appError';
import { applyOrderDispatchReady } from '@modules/order/orderDispatchReady.service';

export async function enqueueShadowfaxReturnPlacement(orderReturnId: string): Promise<void> {
  await enqueueShadowfaxReturnPlacementJob(orderReturnId);
}

export async function ensureShadowfaxReturnShipmentQueued(
  orderReturnId: string,
): Promise<ShadowfaxReturnShipment> {
  const clientCode = tryGetShadowfaxClientCode() ?? 'unconfigured';
  const [shipment] = await ShadowfaxReturnShipment.findOrCreate({
    where: { orderReturnId },
    defaults: {
      orderReturnId,
      status: 'pending',
      clientCode,
      attemptCount: 0,
    },
  });

  if (shipment.status !== 'placed') {
    await shipment.update({
      status: 'pending',
      clientCode: tryGetShadowfaxClientCode() ?? shipment.clientCode,
      errorMessage: null,
    });
  }

  return shipment;
}

export function scheduleShadowfaxReturnPlacement(orderReturnId: string): void {
  void (async () => {
    try {
      await ensureShadowfaxReturnShipmentQueued(orderReturnId);
      await enqueueShadowfaxReturnPlacement(orderReturnId);
      logger.info({ orderReturnId }, 'Shadowfax return placement job enqueued');
    } catch (err) {
      logger.error({ err, orderReturnId }, 'Failed to enqueue Shadowfax return placement');
    }
  })();
}

export async function placeReturnOrderForFinstyReturn(orderReturnId: string): Promise<void> {
  const orderReturn = await OrderReturn.findByPk(orderReturnId);
  if (!orderReturn) {
    logger.warn({ orderReturnId }, 'Shadowfax return placement skipped: return not found');
    return;
  }

  let shipment = await ShadowfaxReturnShipment.findOne({ where: { orderReturnId } });
  if (shipment?.status === 'placed') {
    logger.info({ orderReturnId }, 'Shadowfax return placement skipped: already placed');
    return;
  }

  if (!shipment) {
    shipment = await ensureShadowfaxReturnShipmentQueued(orderReturnId);
  }

  await shipment.update({
    status: 'pending',
    attemptCount: shipment.attemptCount + 1,
    errorMessage: null,
  });

  const clientCode = tryGetShadowfaxClientCode();
  if (!clientCode) {
    await markReturnFailed(
      shipment,
      'Shadowfax client code is not configured. Set SHADOWFAX_CLIENT_CODE in environment.',
    );
    return;
  }

  try {
    const order = await Order.findByPk(orderReturn.orderId);
    if (!order?.addressId) {
      await markReturnFailed(shipment, 'Order is missing a delivery address');
      return;
    }

    const address = await Address.findByPk(order.addressId);
    if (!address) {
      await markReturnFailed(shipment, 'Delivery address not found');
      return;
    }

    if (address.latitude === null || address.longitude === null) {
      await markReturnFailed(shipment, 'Delivery address missing coordinates');
      return;
    }

    const returnItems = await OrderReturnItem.findAll({
      where: { orderReturnId },
      include: [{ model: OrderItem, as: 'orderItem' }],
    });
    if (returnItems.length === 0) {
      await markReturnFailed(shipment, 'Return has no line items');
      return;
    }

    const store = await Store.findByPk(orderReturn.storeId);
    if (!store) {
      await markReturnFailed(shipment, 'Store not found');
      return;
    }

    const pickupLat = Number(address.latitude);
    const pickupLng = Number(address.longitude);
    const dropLat = Number(store.latitude);
    const dropLng = Number(store.longitude);
    if (![pickupLat, pickupLng, dropLat, dropLng].every((n) => Number.isFinite(n))) {
      await markReturnFailed(shipment, 'Invalid pickup or drop coordinates');
      return;
    }

    const sfxItems = returnItems.map((row) => {
      const orderItem = (row as OrderReturnItem & { orderItem: OrderItem }).orderItem;
      return {
        productId: orderItem.productId,
        productName: orderItem.productName,
        unitPrice: Number(row.unitPrice),
        quantity: row.quantity,
      };
    });

    const replay = getShadowfaxReplayFromOrder(order);
    let requestPayload;
    try {
      requestPayload = buildReturnPlaceOrderPayload({
        orderReturnId,
        order,
        store,
        address,
        items: sfxItems,
        replay,
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'PICKUP_PHONE_REQUIRED'
          ? 'Store pickup phone is required (set store.phone or SHADOWFAX_PICKUP_CONTACT)'
          : err instanceof Error
            ? err.message
            : 'Failed to build Shadowfax return request';
      await markReturnFailed(shipment, msg);
      return;
    }

    await shipment.update({ requestPayload, clientCode });

    const raw = await shadowfaxClient.placeOrder(requestPayload);
    const parsed = parsePlaceOrderResponse(raw);

    await shipment.update({
      status: 'placed',
      shadowfaxOrderId: parsed.shadowfaxOrderId,
      trackUrl: parsed.trackUrl,
      deliveryCost: parsed.deliveryCost,
      responsePayload: raw as object,
      errorMessage: null,
      placedAt: new Date(),
    });

    await orderReturn.update({
      status: 'pickup_scheduled',
      logisticsStatus: 'pickup_scheduled',
      shadowfaxOrderId: parsed.shadowfaxOrderId,
      shadowfaxTrackingUrl: parsed.trackUrl,
    });

    logger.info(
      {
        orderReturnId,
        shadowfaxOrderId: parsed.shadowfaxOrderId,
        trackUrl: parsed.trackUrl,
      },
      'Shadowfax return order placed',
    );

    void applyOrderDispatchReady(orderReturn.orderId, {
      shipment_ready_timestamp: new Date().toISOString(),
    }).catch((err) =>
      logger.warn(
        { err, orderId: orderReturn.orderId },
        'dispatch_ready_after_return_failed',
      ),
    );
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Shadowfax return place order failed';

    await markReturnFailed(shipment, message);
    logger.error({ err, orderReturnId }, 'Shadowfax return placement failed');
    throw err;
  }
}

async function markReturnFailed(shipment: ShadowfaxReturnShipment, message: string): Promise<void> {
  await shipment.update({
    status: 'failed',
    errorMessage: message,
  });
  logger.warn({ orderReturnId: shipment.orderReturnId, message }, 'Shadowfax return placement failed (no retry)');
}
