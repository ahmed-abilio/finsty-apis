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
import { syncOrderFromShadowfaxStatusIfDevCallbackEnabled } from './shadowfax-dev-local-callback.service';

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
      status: 'out_for_delivery',
      deliveryMetadata: null,
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'out_for_delivery',
      newStatus: 'delivered',
    });

    const result = await syncOrderFromShadowfaxStatusIfDevCallbackEnabled('order-uuid', statusData);

    expect(result.applied).toBe(true);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid',
        toStatus: 'delivered',
        source: 'shadowfax_dev_local_callback',
        allowManual: true,
      }),
    );
  });
});
