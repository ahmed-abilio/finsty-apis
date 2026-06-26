import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@modules/shadowfax/shadowfax-shipment.model', () => ({
  default: { findOne: vi.fn() },
}));

vi.mock('@modules/shadowfax/shadowfaxStatus.service', () => ({
  default: { fetchOrderStatus: vi.fn() },
}));

vi.mock('@modules/shadowfax/tracking/shadowfax-dev-local-callback.service', () => ({
  syncOrderFromShadowfaxStatus: vi.fn().mockResolvedValue({ attempted: true, applied: true }),
}));

import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import { syncOrderFromShadowfaxStatus } from '@modules/shadowfax/tracking/shadowfax-dev-local-callback.service';
import {
  maybeSyncOrderShadowfaxStatusForOrderDetail,
  syncOrderShadowfaxStatusFromRemote,
} from './orderShadowfaxSync.service';

const shipmentFindOne = vi.mocked(ShadowfaxShipment.findOne);
const fetchOrderStatus = vi.mocked(shadowfaxStatusService.fetchOrderStatus);
const syncStatus = vi.mocked(syncOrderFromShadowfaxStatus);

const remoteStatus = {
  client_code: 'merchant001',
  status: 'DISPATCHED',
  sfx_order_id: 123,
  order_details: { client_order_id: 'order-1' } as never,
  drop_details: {} as never,
  order_items: [],
  track_url: null,
  pickup_details: {} as never,
};

describe('orderShadowfaxSync.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs in-flight delivery orders for order detail', async () => {
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '123',
      trackUrl: null,
    } as ShadowfaxShipment);
    fetchOrderStatus.mockResolvedValue(remoteStatus);

    await maybeSyncOrderShadowfaxStatusForOrderDetail('order-1', 'delivery', 'rider_assigned');

    expect(syncStatus).toHaveBeenCalledWith('order-1', remoteStatus, 'shadowfax_order_detail');
  });

  it('skips pickup orders', async () => {
    await maybeSyncOrderShadowfaxStatusForOrderDetail('order-1', 'pickup', 'confirmed');
    expect(shipmentFindOne).not.toHaveBeenCalled();
  });

  it('skips terminal order statuses for order detail', async () => {
    await maybeSyncOrderShadowfaxStatusForOrderDetail('order-1', 'delivery', 'pending');
    expect(shipmentFindOne).not.toHaveBeenCalled();
  });

  it('syncs cancelled orders to backfill cancellation metadata', async () => {
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '123',
      trackUrl: null,
    } as ShadowfaxShipment);
    fetchOrderStatus.mockResolvedValue({
      ...remoteStatus,
      status: 'CANCELLED',
      cancel_time: '2026-06-23T08:00:00Z',
      cancel_reason: 'RIDER_ISSUE',
    });

    await maybeSyncOrderShadowfaxStatusForOrderDetail('order-1', 'delivery', 'cancelled');

    expect(syncStatus).toHaveBeenCalled();
  });

  it('does not throw when Shadowfax is unavailable', async () => {
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '123',
      trackUrl: null,
    } as ShadowfaxShipment);
    fetchOrderStatus.mockRejectedValue(new Error('timeout'));

    await expect(
      maybeSyncOrderShadowfaxStatusForOrderDetail('order-1', 'delivery', 'picked_up'),
    ).resolves.toBeUndefined();
  });

  it('syncOrderShadowfaxStatusFromRemote returns remote status', async () => {
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '123',
      trackUrl: 'https://track.example',
    } as ShadowfaxShipment);
    fetchOrderStatus.mockResolvedValue({ ...remoteStatus, track_url: null });

    const result = await syncOrderShadowfaxStatusFromRemote(
      'order-1',
      'delivery',
      'picked_up',
      'shadowfax_order_detail',
    );

    expect(result?.track_url).toBe('https://track.example');
    expect(syncStatus).toHaveBeenCalled();
  });
});
