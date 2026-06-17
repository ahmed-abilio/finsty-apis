import Address from '@modules/address/address.model';
import Store from '@modules/store/store.model';
import addressService from '@modules/address/address.service';
import {
  buildShadowfaxReplayFromSubtotal,
  fetchShadowfaxDeliveryQuote,
} from '@modules/shadowfax/shadowfaxDelivery';
import { getPublicDeliveryConfig } from '@config/delivery.config';
import { computeTaxOnSubtotal, getPlatformFee } from '@config/pricing.config';
import { AppError } from '@utils/appError';

export interface DeliveryQuoteResult {
  addressId: string;
  serviceable: boolean;
  /** Live Shadowfax delivery fee (INR). */
  quotedDeliveryCharge: number;
  /** Fee added to order total (0 when waived by FREE_DELIVERY coupon). */
  deliveryChargeApplied: number;
  deliveryFeeWaived: boolean;
  deliveryConfig: ReturnType<typeof getPublicDeliveryConfig>;
  subtotal: number;
  taxAmount: number;
  platformFee: number;
  estimatedPayableTotal: number;
}

export async function resolveDeliveryQuote(params: {
  userId: string;
  subtotal: number;
  storeId: string;
  addressId?: string;
  deliveryWaivedByCoupon?: boolean;
  cartId?: string;
}): Promise<DeliveryQuoteResult> {
  const { userId, subtotal, storeId, cartId } = params;
  const deliveryFeeWaived = params.deliveryWaivedByCoupon === true;

  let address: Address | null = null;
  if (params.addressId) {
    address = await Address.findOne({ where: { id: params.addressId, userId } });
    if (!address) throw AppError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
  } else {
    address = await addressService.getDefaultAddress(userId);
  }

  if (!address) {
    throw AppError.badRequest(
      'Add a default delivery address with coordinates to get a delivery quote',
      'DEFAULT_ADDRESS_REQUIRED',
    );
  }

  if (address.latitude === null || address.longitude === null) {
    throw AppError.badRequest(
      'Address must include latitude and longitude for delivery',
      'ADDRESS_COORDINATES_REQUIRED',
    );
  }

  const store = await Store.findByPk(storeId, { attributes: ['id', 'latitude', 'longitude'] });
  if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');

  const pickupLat = Number(store.latitude);
  const pickupLng = Number(store.longitude);
  const dropLat = Number(address.latitude);
  const dropLng = Number(address.longitude);
  if (![pickupLat, pickupLng, dropLat, dropLng].every((n) => Number.isFinite(n))) {
    throw AppError.badRequest('Invalid store or address coordinates', 'INVALID_COORDINATES');
  }

  const subtotalRounded = parseFloat(subtotal.toFixed(2));

  const replay = buildShadowfaxReplayFromSubtotal(subtotalRounded, 'true');
  const quote = await fetchShadowfaxDeliveryQuote({
    pickupLatitude: pickupLat,
    pickupLongitude: pickupLng,
    dropLatitude: dropLat,
    dropLongitude: dropLng,
    replay,
    coid: cartId,
  });

  if (!quote.serviceable) {
    throw AppError.badRequest('Delivery location is not serviceable', 'DELIVERY_NOT_SERVICEABLE');
  }

  const quotedDeliveryCharge = parseFloat(quote.deliveryFee.toFixed(2));
  const deliveryChargeApplied = deliveryFeeWaived ? 0 : quotedDeliveryCharge;
  const taxAmount = computeTaxOnSubtotal(subtotalRounded);
  const platformFee = getPlatformFee();
  const estimatedPayableTotal = parseFloat(
    (subtotalRounded + taxAmount + platformFee + deliveryChargeApplied).toFixed(2),
  );

  return {
    addressId: address.id,
    serviceable: true,
    quotedDeliveryCharge,
    deliveryChargeApplied,
    deliveryFeeWaived,
    deliveryConfig: getPublicDeliveryConfig(),
    subtotal: subtotalRounded,
    taxAmount,
    platformFee,
    estimatedPayableTotal,
  };
}
