import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@config/database', () => ({
  default: { query: mocks.queryMock },
}));

import { fetchVendorCouponStats } from './vendorCouponStats';

const STORE_ID = '11111111-1111-1111-1111-111111111111';

describe('fetchVendorCouponStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns coupon counts and zero usage when store has no coupons or redemptions', async () => {
    mocks.queryMock
      .mockResolvedValueOnce([
        { totalCoupons: 0, activeCount: 0, inactiveCount: 0 },
      ])
      .mockResolvedValueOnce([{ usedCount: 0, totalDiscountAmount: '0' }]);

    const stats = await fetchVendorCouponStats(STORE_ID);

    expect(stats).toEqual({
      totalCoupons: 0,
      activeCount: 0,
      inactiveCount: 0,
      usedCount: 0,
      totalDiscountAmount: 0,
    });
    expect(mocks.queryMock).toHaveBeenCalledTimes(2);
  });

  it('returns active and inactive counts from coupons table', async () => {
    mocks.queryMock
      .mockResolvedValueOnce([
        { totalCoupons: 5, activeCount: 3, inactiveCount: 2 },
      ])
      .mockResolvedValueOnce([{ usedCount: 10, totalDiscountAmount: '150.5' }]);

    const stats = await fetchVendorCouponStats(STORE_ID);

    expect(stats.totalCoupons).toBe(5);
    expect(stats.activeCount).toBe(3);
    expect(stats.inactiveCount).toBe(2);
    expect(stats.usedCount).toBe(10);
    expect(stats.totalDiscountAmount).toBe(150.5);
  });

  it('includes vendor sales order statuses in usage query', async () => {
    mocks.queryMock
      .mockResolvedValueOnce([
        { totalCoupons: 1, activeCount: 1, inactiveCount: 0 },
      ])
      .mockResolvedValueOnce([{ usedCount: 2, totalDiscountAmount: '20' }]);

    await fetchVendorCouponStats(STORE_ID);

    const usageSql = String(mocks.queryMock.mock.calls[1]?.[0]);
    expect(usageSql).toContain('o.status IN (:statuses)');
    const usageReplacements = mocks.queryMock.mock.calls[1]?.[1]?.replacements as {
      statuses: string[];
    };
    expect(usageReplacements.statuses).toEqual([
      'confirmed',
      'rider_assigned',
      'at_store',
      'picked_up',
      'out_for_delivery',
      'delivered',
    ]);
  });

  it('applies date range filter to usage query when range is provided', async () => {
    const range = {
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-01-31T23:59:59.999Z'),
    };

    mocks.queryMock
      .mockResolvedValueOnce([
        { totalCoupons: 2, activeCount: 1, inactiveCount: 1 },
      ])
      .mockResolvedValueOnce([{ usedCount: 1, totalDiscountAmount: '50' }]);

    await fetchVendorCouponStats(STORE_ID, range);

    const usageSql = String(mocks.queryMock.mock.calls[1]?.[0]);
    expect(usageSql).toContain('o."createdAt" >= :rangeStart');
    expect(usageSql).toContain('o."createdAt" <= :rangeEnd');
    const usageReplacements = mocks.queryMock.mock.calls[1]?.[1]?.replacements as {
      rangeStart: Date;
      rangeEnd: Date;
    };
    expect(usageReplacements.rangeStart).toEqual(range.start);
    expect(usageReplacements.rangeEnd).toEqual(range.end);

    const countSql = String(mocks.queryMock.mock.calls[0]?.[0]);
    expect(countSql).not.toContain('createdAt');
  });
});
