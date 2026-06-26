import { describe, it, expect } from 'vitest';
import { canTransition, canManualTransition, canShadowfaxTransition } from './order-status.fsm';

describe('order-status.fsm', () => {
  it('allows forward logistics chain', () => {
    expect(canTransition('confirmed', 'rider_assigned')).toBe(true);
    expect(canTransition('rider_assigned', 'at_store')).toBe(true);
    expect(canTransition('arrived', 'delivered')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('delivered', 'picked_up')).toBe(false);
  });

  it('allows cancel from non-delivered states', () => {
    expect(canTransition('picked_up', 'cancelled')).toBe(true);
    expect(canTransition('delivered', 'cancelled')).toBe(false);
  });

  it('allows delivered to returned', () => {
    expect(canTransition('delivered', 'returned')).toBe(true);
  });

  it('allows manual vendor skip steps', () => {
    expect(canManualTransition('confirmed', 'arrived')).toBe(true);
    expect(canManualTransition('rider_assigned', 'picked_up')).toBe(true);
  });

  it('allows Shadowfax cancel from in-flight delivery states', () => {
    expect(canShadowfaxTransition('picked_up', 'cancelled')).toBe(true);
    expect(canShadowfaxTransition('arrived', 'cancelled')).toBe(true);
  });

  it('allows Shadowfax return without a prior delivered state', () => {
    expect(canShadowfaxTransition('arrived', 'returned')).toBe(true);
    expect(canShadowfaxTransition('picked_up', 'returned')).toBe(true);
    expect(canShadowfaxTransition('delivered', 'returned')).toBe(true);
  });

  it('rejects Shadowfax return from pre-dispatch states', () => {
    expect(canShadowfaxTransition('confirmed', 'returned')).toBe(false);
  });
});
