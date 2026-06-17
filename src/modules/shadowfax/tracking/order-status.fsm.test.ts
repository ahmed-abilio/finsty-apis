import { describe, it, expect } from 'vitest';
import { canTransition, canManualTransition } from './order-status.fsm';

describe('order-status.fsm', () => {
  it('allows forward logistics chain', () => {
    expect(canTransition('confirmed', 'rider_assigned')).toBe(true);
    expect(canTransition('rider_assigned', 'at_store')).toBe(true);
    expect(canTransition('out_for_delivery', 'delivered')).toBe(true);
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
    expect(canManualTransition('confirmed', 'out_for_delivery')).toBe(true);
  });
});
