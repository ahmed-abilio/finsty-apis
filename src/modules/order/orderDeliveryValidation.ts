import Order from './order.model';
import Address from '@modules/address/address.model';
import OrderItem from './order-item.model';
import Product from '@modules/product/product.model';
import Store from '@modules/store/store.model';
import { AppError } from '@utils/appError';
import {
  buildShadowfaxReplayFromSubtotal,
  fetchShadowfaxDeliveryQuote,
  type ShadowfaxReplaySnapshot,
} from '@modules/shadowfax/shadowfaxDelivery';

function getShadowfaxReplayFromOrder(order: Order): ShadowfaxReplaySnapshot {
  const meta = order.metadata as { shadowfaxReplay?: ShadowfaxReplaySnapshot } | null;
  if (meta?.shadowfaxReplay?.orderValue) {
    return meta.shadowfaxReplay;
  }
  return buildShadowfaxReplayFromSubtotal(Number(order.subtotal), 'true');
}

/**
 * For delivery orders, re-checks address ownership and coordinates and replays Shadowfax.
 * Paid delivery: Shadowfax fee must match persisted `order.deliveryCharge`.
 * Free delivery: location must still be serviceable.
 */
export async function assertOrderDeliveryShadowfaxValidForPayment(
  order: Order,
  userId: string,
): Promise<void> {
  if (order.deliveryType !== 'delivery') return;

  if (!order.addressId) {
    throw AppError.badRequest('Order is missing a delivery address', 'ADDRESS_REQUIRED');
  }

  const address = await Address.findOne({ where: { id: order.addressId, userId } });
  if (!address) {
    throw AppError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
  }
  if (address.latitude === null || address.longitude === null) {
    throw AppError.badRequest(
      'Address must include latitude and longitude for delivery',
      'ADDRESS_COORDINATES_REQUIRED',
    );
  }

  const firstLine = await OrderItem.findOne({
    where: { orderId: order.id },
    include: [{ model: Product, as: 'product', attributes: ['id', 'storeId'] }],
  });
  if (!firstLine) {
    throw AppError.badRequest('Order has no line items', 'ORDER_ITEMS_MISSING');
  }

  const product = (firstLine as unknown as { product?: Product }).product;
  const storeId = product?.storeId;
  if (!storeId) {
    throw AppError.badRequest('Could not resolve store for delivery validation', 'STORE_NOT_FOUND');
  }

  const store = await Store.findByPk(storeId, { attributes: ['id', 'latitude', 'longitude'] });
  if (!store) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }

  const pickupLat = Number(store.latitude);
  const pickupLng = Number(store.longitude);
  const dropLat = Number(address.latitude);
  const dropLng = Number(address.longitude);
  if (![pickupLat, pickupLng, dropLat, dropLng].every((n) => Number.isFinite(n))) {
    throw AppError.badRequest('Invalid coordinates for delivery validation', 'INVALID_COORDINATES');
  }

  const replay = getShadowfaxReplayFromOrder(order);
  const quote = await fetchShadowfaxDeliveryQuote({
    pickupLatitude: pickupLat,
    pickupLongitude: pickupLng,
    dropLatitude: dropLat,
    dropLongitude: dropLng,
    replay,
    coid: order.id,
  });

  if (!quote.serviceable) {
    throw AppError.badRequest('Delivery location is not serviceable', 'DELIVERY_NOT_SERVICEABLE');
  }

  const persistedCharge = parseFloat(Number(order.deliveryCharge).toFixed(2));
  if (persistedCharge > 0.01) {
    if (Math.abs(quote.deliveryFee - persistedCharge) > 0.01) {
      throw AppError.badRequest(
        'Delivery fee has changed — refresh checkout and try again',
        'DELIVERY_CHARGE_MISMATCH',
      );
    }
  }
}
