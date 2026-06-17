import type { OrderStatus } from '@modules/order/order.model';

export const ORDER_STATUS_VALUES: OrderStatus[] = [
  'pending',
  'confirmed',
  'rider_assigned',
  'at_store',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
];

/** Accept legacy vendor API status names during transition */
const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  processing: 'at_store',
  shipped: 'out_for_delivery',
};

export function normalizeOrderStatusInput(status: string): OrderStatus {
  const key = status.trim().toLowerCase();
  return LEGACY_STATUS_MAP[key] ?? (key as OrderStatus);
}

export const VENDOR_MANUAL_TARGET_STATUSES: OrderStatus[] = [
  'confirmed',
  'rider_assigned',
  'at_store',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'cancelled',
];
