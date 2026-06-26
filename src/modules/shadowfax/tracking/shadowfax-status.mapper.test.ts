import { describe, it, expect } from 'vitest';
import { mapShadowfaxStatusToInternal } from './shadowfax-status.mapper';

describe('shadowfax-status.mapper', () => {
  it('maps known Shadowfax statuses', () => {
    expect(mapShadowfaxStatusToInternal('ALLOTTED')).toBe('rider_assigned');
    expect(mapShadowfaxStatusToInternal('ARRIVED_CUSTOMER_DOORSTEP')).toBe('arrived');
    expect(mapShadowfaxStatusToInternal('DELIVERED')).toBe('delivered');
    expect(mapShadowfaxStatusToInternal('RETURNED_TO_SELLER')).toBe('returned');
    expect(mapShadowfaxStatusToInternal('CANCELLED')).toBe('cancelled');
    expect(mapShadowfaxStatusToInternal('CANCELLED_BY_CUSTOMER')).toBe('cancelled');
  });

  it('maps cancel and return aliases', () => {
    expect(mapShadowfaxStatusToInternal('CANCELED')).toBe('cancelled');
    expect(mapShadowfaxStatusToInternal('CANCELLED_BY_RIDER')).toBe('cancelled');
    expect(mapShadowfaxStatusToInternal('RETURNED')).toBe('returned');
    expect(mapShadowfaxStatusToInternal('RTS')).toBe('returned');
  });

  it('returns null for unknown statuses', () => {
    expect(mapShadowfaxStatusToInternal('UNKNOWN')).toBeNull();
  });
});
