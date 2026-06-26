import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@modules/platform-settings/platform-settings.service', () => ({
  isShadowfaxDevLocalCallbackEnabled: vi.fn(),
}));

vi.mock('@modules/order/order.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('./order-status-transition.service', () => ({
  transitionOrderStatus: vi.fn(),
}));

import Order from '@modules/order/order.model';
import { isShadowfaxDevLocalCallbackEnabled } from '@modules/platform-settings/platform-settings.service';
import { transitionOrderStatus } from './order-status-transition.service';
import {
  syncOrderFromShadowfaxStatus,
  syncOrderFromShadowfaxStatusIfDevCallbackEnabled,
} from './shadowfax-dev-local-callback.service';

const isEnabled = vi.mocked(isShadowfaxDevLocalCallbackEnabled);
const findByPk = vi.mocked(Order.findByPk);
const transition = vi.mocked(transitionOrderStatus);

const statusData = {
  client_code: 'merchant001',
  status: 'DELIVERED',
  sfx_order_id: 123,
  order_details: {
    client_order_id: 'order-uuid',
    order_value: 100,
    scheduled_time: '2026-06-15 12:00:00',
    paid: 'true',
    preparation_time: 0,
    pickup_eta: null,
    drop_eta: null,
    allot_time: null,
    arrival_time: null,
    dispatch_time: null,
    delivery_time: '2026-06-15 13:00:00',
    vehicle_number: null,
    order_date: '2026-06-15',
  },
  drop_details: {} as never,
  order_items: [],
  track_url: null,
  pickup_details: {} as never,
};

describe('shadowfax-dev-local-callback.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('skips sync when dev local callback is disabled', async () => {
    isEnabled.mockResolvedValue(false);

    const result = await syncOrderFromShadowfaxStatusIfDevCallbackEnabled('order-uuid', statusData);

    expect(result).toEqual({ attempted: false, applied: false, reason: 'dev_local_callback_disabled' });
    expect(transition).not.toHaveBeenCalled();
  });

  it('syncs order when dev local callback is enabled', async () => {
    isEnabled.mockResolvedValue(true);
    findByPk.mockResolvedValue({
      id: 'order-uuid',
      status: 'arrived',
      deliveryMetadata: null,
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'arrived',
      newStatus: 'delivered',
    });

    const result = await syncOrderFromShadowfaxStatusIfDevCallbackEnabled('order-uuid', statusData);

    expect(result.applied).toBe(true);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid',
        toStatus: 'delivered',
        source: 'shadowfax_dev_local_callback',
      }),
    );
  });

  it('syncs picked_up to cancelled when Shadowfax is CANCELLED', async () => {
    findByPk.mockResolvedValue({
      id: 'order-uuid',
      status: 'picked_up',
      deliveryMetadata: null,
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'picked_up',
      newStatus: 'cancelled',
    });

    const cancelledStatus = {
      ...statusData,
      status: 'CANCELLED',
      cancel_time: '2026-06-15 14:00:00',
      cancel_reason: 'RIDER_ISSUE',
    };
    const result = await syncOrderFromShadowfaxStatus(
      'order-uuid',
      cancelledStatus,
      'shadowfax_delivery_status',
    );

    expect(result.applied).toBe(true);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid',
        toStatus: 'cancelled',
        source: 'shadowfax_delivery_status',
        orderPatch: expect.objectContaining({
          cancelledAt: expect.any(Date),
        }),
      }),
    );
  });

  it('syncs arrived to returned when Shadowfax is RETURNED_TO_SELLER', async () => {
    findByPk.mockResolvedValue({
      id: 'order-uuid',
      status: 'arrived',
      deliveryMetadata: null,
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'arrived',
      newStatus: 'returned',
    });

    const returnedStatus = {
      ...statusData,
      status: 'RETURNED_TO_SELLER',
      rts_time: '2026-06-15 15:00:00',
    };
    const result = await syncOrderFromShadowfaxStatus(
      'order-uuid',
      returnedStatus,
      'shadowfax_delivery_status',
    );

    expect(result.applied).toBe(true);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid',
        toStatus: 'returned',
        source: 'shadowfax_delivery_status',
        orderPatch: expect.objectContaining({
          returnedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('syncs rider_assigned to picked_up when Shadowfax is DISPATCHED (skips at_store)', async () => {
    findByPk.mockResolvedValue({
      id: 'order-uuid',
      status: 'rider_assigned',
      deliveryMetadata: null,
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'rider_assigned',
      newStatus: 'picked_up',
    });

    const dispatchedStatus = { ...statusData, status: 'DISPATCHED' };
    const result = await syncOrderFromShadowfaxStatus(
      'order-uuid',
      dispatchedStatus,
      'shadowfax_delivery_status',
    );

    expect(result.applied).toBe(true);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid',
        toStatus: 'picked_up',
        source: 'shadowfax_delivery_status',
      }),
    );
  });

  it('syncs confirmed to rider_assigned via delivery-status source', async () => {
    findByPk.mockResolvedValue({
      id: 'order-uuid',
      status: 'confirmed',
      deliveryMetadata: null,
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'confirmed',
      newStatus: 'rider_assigned',
    });

    const allottedStatus = { ...statusData, status: 'ALLOTTED' };
    const result = await syncOrderFromShadowfaxStatus(
      'order-uuid',
      allottedStatus,
      'shadowfax_delivery_status',
    );

    expect(result.applied).toBe(true);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid',
        toStatus: 'rider_assigned',
        source: 'shadowfax_delivery_status',
      }),
    );
  });
});
