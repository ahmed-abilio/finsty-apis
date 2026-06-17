import type { OrderStatus } from '@modules/order/order.model';

const SHADOWFAX_TO_INTERNAL: Record<string, OrderStatus> = {
  ALLOTTED: 'rider_assigned',
  ARRIVED: 'at_store',
  DISPATCHED: 'picked_up',
  ARRIVED_CUSTOMER_DOORSTEP: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  CANCELLED_BY_CUSTOMER: 'cancelled',
  RETURNED_TO_SELLER: 'returned',
};

export function mapShadowfaxStatusToInternal(shadowfaxStatus: string): OrderStatus | null {
  const key = shadowfaxStatus?.trim().toUpperCase();
  if (!key) return null;
  return SHADOWFAX_TO_INTERNAL[key] ?? null;
}

export function isKnownShadowfaxStatus(shadowfaxStatus: string): boolean {
  return mapShadowfaxStatusToInternal(shadowfaxStatus) !== null;
}
