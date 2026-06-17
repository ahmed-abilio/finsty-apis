import Order from '@modules/order/order.model';
import OrderItem from '@modules/order/order-item.model';
import Address from '@modules/address/address.model';
import Product from '@modules/product/product.model';
import Store from '@modules/store/store.model';
import ShadowfaxShipment from './shadowfax-shipment.model';
import shadowfaxClient from './shadowfax.client';
import { tryGetShadowfaxClientCode } from './shadowfax.config';
import {
  buildPlaceOrderPayload,
  getShadowfaxReplayFromOrder,
  parsePlaceOrderResponse,
} from './shadowfaxPlaceOrder';
import { enqueueShadowfaxPlacementJob } from '@queues/shadowfaxQueue';
import logger from '@utils/logger';
import { AppError } from '@utils/appError';

export async function enqueueShadowfaxPlacement(orderId: string): Promise<void> {
  await enqueueShadowfaxPlacementJob(orderId);
}

/**
 * Creates or touches a pending shipment row so DB reflects enqueue even if the worker is delayed.
 */
export async function ensureShadowfaxShipmentQueued(orderId: string): Promise<ShadowfaxShipment> {
  const clientCode = tryGetShadowfaxClientCode() ?? 'unconfigured';
  const [shipment] = await ShadowfaxShipment.findOrCreate({
    where: { orderId },
    defaults: {
      orderId,
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

/** Fire-and-forget enqueue after payment confirms a delivery order. */
export function scheduleShadowfaxPlacementIfDelivery(order: {
  id: string;
  deliveryType: string;
}): void {
  if (order.deliveryType !== 'delivery') return;

  void (async () => {
    try {
      await ensureShadowfaxShipmentQueued(order.id);
      await enqueueShadowfaxPlacement(order.id);
      logger.info({ orderId: order.id }, 'Shadowfax placement job enqueued');
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'Failed to enqueue Shadowfax placement');
    }
  })();
}

/**
 * Places a Shadowfax v2 delivery order for a confirmed Finsty delivery order.
 * Idempotent when status is already `placed`. Non-throwing for missing data (marks failed).
 */
export async function placeOrderForFinstyOrder(orderId: string): Promise<void> {
  const order = await Order.findByPk(orderId);
  if (!order) {
    logger.warn({ orderId }, 'Shadowfax placement skipped: order not found');
    return;
  }

  if (order.deliveryType !== 'delivery') {
    return;
  }

  if (order.status !== 'confirmed') {
    logger.info(
      { orderId, status: order.status },
      'Shadowfax placement skipped: order not confirmed',
    );
    return;
  }

  let shipment = await ShadowfaxShipment.findOne({ where: { orderId } });
  if (shipment?.status === 'placed') {
    logger.info({ orderId }, 'Shadowfax placement skipped: already placed');
    return;
  }

  if (!shipment) {
    shipment = await ensureShadowfaxShipmentQueued(orderId);
  }

  await shipment.update({
    status: 'pending',
    attemptCount: shipment.attemptCount + 1,
    errorMessage: null,
  });

  const clientCode = tryGetShadowfaxClientCode();
  if (!clientCode) {
    await markFailed(
      shipment,
      'Shadowfax client code is not configured. Set SHADOWFAX_CLIENT_CODE in environment.',
    );
    return;
  }

  try {
    if (!order.addressId) {
      await markFailed(shipment, 'Order is missing a delivery address');
      return;
    }

    const address = await Address.findByPk(order.addressId);
    if (!address) {
      await markFailed(shipment, 'Delivery address not found');
      return;
    }

    if (address.latitude === null || address.longitude === null) {
      await markFailed(shipment, 'Delivery address missing coordinates');
      return;
    }

    const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
    if (orderItems.length === 0) {
      await markFailed(shipment, 'Order has no line items');
      return;
    }

    const firstLine = await OrderItem.findOne({
      where: { orderId: order.id },
      include: [{ model: Product, as: 'product', attributes: ['id', 'storeId'] }],
    });
    const product = (firstLine as unknown as { product?: Product })?.product;
    const storeId = product?.storeId;
    if (!storeId) {
      await markFailed(shipment, 'Could not resolve store for delivery');
      return;
    }

    const store = await Store.findByPk(storeId);
    if (!store) {
      await markFailed(shipment, 'Store not found');
      return;
    }

    const pickupLat = Number(store.latitude);
    const pickupLng = Number(store.longitude);
    const dropLat = Number(address.latitude);
    const dropLng = Number(address.longitude);
    if (![pickupLat, pickupLng, dropLat, dropLng].every((n) => Number.isFinite(n))) {
      await markFailed(shipment, 'Invalid pickup or drop coordinates');
      return;
    }

    const replay = getShadowfaxReplayFromOrder(order);
    let requestPayload;
    try {
      requestPayload = buildPlaceOrderPayload({
        order,
        store,
        address,
        items: orderItems,
        replay,
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'PICKUP_PHONE_REQUIRED'
          ? 'Store pickup phone is required (set store.phone or SHADOWFAX_PICKUP_CONTACT)'
          : err instanceof Error
            ? err.message
            : 'Failed to build Shadowfax request';
      await markFailed(shipment, msg);
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

    const sfxNumeric =
      parsed.shadowfaxOrderId != null && /^[0-9]+$/.test(parsed.shadowfaxOrderId)
        ? Number(parsed.shadowfaxOrderId)
        : null;

    await Order.update(
      {
        shadowfaxOrderId: sfxNumeric,
        shadowfaxTrackingUrl: parsed.trackUrl,
        deliveryPartner: 'SHADOWFAX',
      },
      { where: { id: orderId } },
    );

    logger.info(
      {
        orderId,
        shadowfaxOrderId: parsed.shadowfaxOrderId,
        trackUrl: parsed.trackUrl,
      },
      'Shadowfax order placed',
    );
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Shadowfax place order failed';

    await markFailed(shipment, message);
    logger.error({ err, orderId }, 'Shadowfax placement failed');
    throw err;
  }
}

async function markFailed(shipment: ShadowfaxShipment, message: string): Promise<void> {
  await shipment.update({
    status: 'failed',
    errorMessage: message,
  });
  logger.warn({ orderId: shipment.orderId, message }, 'Shadowfax placement failed (no retry)');
}
