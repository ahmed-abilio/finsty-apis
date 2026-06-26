import type { OrderStatus } from '@modules/order/order.model';

const SHADOWFAX_TO_INTERNAL: Record<string, OrderStatus> = {
  ALLOTTED: 'rider_assigned',
  ARRIVED: 'at_store',
  DISPATCHED: 'picked_up',
  ARRIVED_CUSTOMER_DOORSTEP: 'arrived',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  CANCELLED_BY_CUSTOMER: 'cancelled',
  CANCELLED_BY_SELLER: 'cancelled',
  CANCELLED_BY_RIDER: 'cancelled',
  CANCELED: 'cancelled',
  RETURNED_TO_SELLER: 'returned',
  RETURNED: 'returned',
  RETURN_TO_SELLER: 'returned',
  RTS: 'returned',
};

export function mapShadowfaxStatusToInternal(shadowfaxStatus: string): OrderStatus | null {
  const key = shadowfaxStatus?.trim().toUpperCase();
  if (!key) return null;
  return SHADOWFAX_TO_INTERNAL[key] ?? null;
}

export function isShadowfaxCancelledStatus(shadowfaxStatus: string): boolean {
  return mapShadowfaxStatusToInternal(shadowfaxStatus) === 'cancelled';
}

export function isShadowfaxReturnedStatus(shadowfaxStatus: string): boolean {
  return mapShadowfaxStatusToInternal(shadowfaxStatus) === 'returned';
}

export function isKnownShadowfaxStatus(shadowfaxStatus: string): boolean {
  return mapShadowfaxStatusToInternal(shadowfaxStatus) !== null;
}
