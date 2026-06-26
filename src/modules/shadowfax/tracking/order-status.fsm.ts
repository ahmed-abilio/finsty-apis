import type { OrderStatus } from '@modules/order/order.model';

const FORWARD: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed'],
  confirmed: ['rider_assigned'],
  rider_assigned: ['at_store'],
  at_store: ['picked_up'],
  picked_up: ['arrived'],
  arrived: ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const CANCELLABLE: OrderStatus[] = [
  'pending',
  'confirmed',
  'rider_assigned',
  'at_store',
  'picked_up',
  'arrived',
];

export interface TransitionOptions {
  allowCancel?: boolean;
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  options: TransitionOptions = {},
): boolean {
  if (from === to) return true;

  if (to === 'cancelled') {
    return options.allowCancel !== false && CANCELLABLE.includes(from);
  }

  const allowed = FORWARD[from] ?? [];
  return allowed.includes(to);
}

export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  options?: TransitionOptions,
): void {
  if (!canTransition(from, to, options)) {
    throw new Error(`INVALID_STATUS_TRANSITION:${from}->${to}`);
  }
}

/** Vendor/admin manual overrides beyond strict forward chain */
const MANUAL_EXTRA: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ['at_store', 'picked_up', 'arrived', 'delivered', 'cancelled'],
  rider_assigned: ['picked_up', 'arrived', 'delivered', 'cancelled'],
  at_store: ['arrived', 'delivered', 'cancelled'],
  picked_up: ['delivered', 'cancelled'],
  arrived: ['cancelled'],
};

export function canManualTransition(
  from: OrderStatus,
  to: OrderStatus,
  options: TransitionOptions = {},
): boolean {
  if (canTransition(from, to, options)) return true;
  if (to === 'cancelled' && options.allowCancel !== false && CANCELLABLE.includes(from)) {
    return true;
  }
  const extras = MANUAL_EXTRA[from] ?? [];
  return extras.includes(to);
}

/** Shadowfax may skip steps and return-to-seller before a strict delivered state. */
const SHADOWFAX_RETURNABLE: OrderStatus[] = [
  'rider_assigned',
  'at_store',
  'picked_up',
  'arrived',
  'delivered',
];

export function canShadowfaxTransition(
  from: OrderStatus,
  to: OrderStatus,
  options: TransitionOptions = {},
): boolean {
  if (canManualTransition(from, to, options)) return true;
  if (to === 'returned' && SHADOWFAX_RETURNABLE.includes(from)) return true;
  return false;
}
