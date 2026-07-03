import { describe, expect, it } from 'vitest';
import {
  computeLineRefundAmount,
  isWithinReturnWindow,
  mapLogisticsToReturnStatus,
  mapShadowfaxStatusToReturnLogistics,
  RETURN_WINDOW_MS,
} from './orderReturn.utils';

describe('orderReturn.utils', () => {
  it('allows return within 1 hour of delivery', () => {
    const deliveredAt = new Date(Date.now() - 30 * 60 * 1000);
    expect(isWithinReturnWindow(deliveredAt)).toBe(true);
  });

  it('rejects return after 1 hour', () => {
    const deliveredAt = new Date(Date.now() - RETURN_WINDOW_MS - 1000);
    expect(isWithinReturnWindow(deliveredAt)).toBe(false);
  });

  it('computes line refund as unitPrice × quantity', () => {
    expect(computeLineRefundAmount(99.5, 2)).toBe(199);
    expect(computeLineRefundAmount(10.333, 3)).toBe(31);
  });

  it('maps shadowfax statuses to return logistics', () => {
    expect(mapShadowfaxStatusToReturnLogistics('ALLOTTED')).toBe('rider_assigned');
    expect(mapShadowfaxStatusToReturnLogistics('DELIVERED')).toBe('delivered');
  });

  it('maps delivered logistics to pending_inspection', () => {
    expect(mapLogisticsToReturnStatus('delivered')).toBe('pending_inspection');
    expect(mapLogisticsToReturnStatus('picked_up')).toBe('picked_up');
  });
});
