import { describe, it, expect } from 'vitest';
import { mapShadowfaxStatusToInternal } from './shadowfax-status.mapper';

describe('shadowfax-status.mapper', () => {
  it('maps known Shadowfax statuses', () => {
    expect(mapShadowfaxStatusToInternal('ALLOTTED')).toBe('rider_assigned');
    expect(mapShadowfaxStatusToInternal('DELIVERED')).toBe('delivered');
    expect(mapShadowfaxStatusToInternal('RETURNED_TO_SELLER')).toBe('returned');
  });

  it('returns null for unknown statuses', () => {
    expect(mapShadowfaxStatusToInternal('UNKNOWN')).toBeNull();
  });
});
