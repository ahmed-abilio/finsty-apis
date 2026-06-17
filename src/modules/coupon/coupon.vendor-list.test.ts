import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAndCountAllMock = vi.fn();

vi.mock('./coupon.model', () => ({
  default: {
    findAndCountAll: (...args: unknown[]) => findAndCountAllMock(...args),
  },
}));

import couponService from './coupon.service';

const STORE_ID = '11111111-1111-1111-1111-111111111111';

describe('listVendorCoupons', () => {
  beforeEach(() => {
    findAndCountAllMock.mockReset();
    findAndCountAllMock.mockResolvedValue({ count: 0, rows: [] });
  });

  it('does not filter by isActive when omitted (includes inactive)', async () => {
    await couponService.listVendorCoupons(STORE_ID, { page: 1, limit: 20 });

    expect(findAndCountAllMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID },
      }),
    );
  });

  it('filters by isActive when explicitly provided', async () => {
    await couponService.listVendorCoupons(STORE_ID, { isActive: false });

    expect(findAndCountAllMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID, isActive: false },
      }),
    );
  });
});
