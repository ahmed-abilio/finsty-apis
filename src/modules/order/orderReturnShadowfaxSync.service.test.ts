import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@modules/shadowfax/tracking/order-return-shadowfax.processor', () => ({
  fetchAndSyncShadowfaxReturnDeliveryStatus: vi.fn(),
}));

import { fetchAndSyncShadowfaxReturnDeliveryStatus } from '@modules/shadowfax/tracking/order-return-shadowfax.processor';
import {
  maybeSyncOrderReturnShadowfaxStatusForReturnDetail,
  syncReturnShadowfaxStatusFromRemote,
} from './orderReturnShadowfaxSync.service';

const fetchAndSync = vi.mocked(fetchAndSyncShadowfaxReturnDeliveryStatus);

describe('orderReturnShadowfaxSync.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAndSync.mockResolvedValue(null);
  });

  it('syncs active delivery returns', async () => {
    await syncReturnShadowfaxStatusFromRemote('return-1', 'delivery', 'picked_up');
    expect(fetchAndSync).toHaveBeenCalledWith('return-1');
  });

  it('skips pickup orders', async () => {
    await syncReturnShadowfaxStatusFromRemote('return-1', 'pickup', 'picked_up');
    expect(fetchAndSync).not.toHaveBeenCalled();
  });

  it('skips terminal return statuses', async () => {
    await syncReturnShadowfaxStatusFromRemote('return-1', 'delivery', 'refund_approved');
    expect(fetchAndSync).not.toHaveBeenCalled();
  });

  it('maybeSync swallows errors', async () => {
    fetchAndSync.mockRejectedValue(new Error('network'));
    await expect(
      maybeSyncOrderReturnShadowfaxStatusForReturnDetail('return-1', 'delivery', 'rider_assigned'),
    ).resolves.toBeUndefined();
  });
});
