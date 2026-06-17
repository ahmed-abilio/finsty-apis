import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetShadowfaxMetricsForTests } from '@observability/shadowfax.metrics';

vi.mock('@modules/order/order.model', () => ({
  default: { findAll: vi.fn() },
}));

vi.mock('@modules/shadowfax/shadowfaxStatus.service', () => ({
  default: { fetchOrderStatus: vi.fn() },
}));

vi.mock('./order-status-transition.service', () => ({
  transitionOrderStatus: vi.fn(),
}));

vi.mock('./order-rider-location.repository', () => ({
  deleteRiderLocationsOlderThan: vi.fn().mockResolvedValue(0),
}));

vi.mock('@modules/platform-settings/platform-settings.service', () => ({
  isShadowfaxDevLocalCallbackEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('./shadowfax-dev-local-callback.service', () => ({
  syncOrderFromShadowfaxStatusIfDevCallbackEnabled: vi.fn(),
}));

import Order from '@modules/order/order.model';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import { transitionOrderStatus } from './order-status-transition.service';
import { runShadowfaxReconciliation } from './shadowfax-reconciliation.service';

const findAll = vi.mocked(Order.findAll);
const fetchStatus = vi.mocked(shadowfaxStatusService.fetchOrderStatus);
const transition = vi.mocked(transitionOrderStatus);

describe('shadowfax-reconciliation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetShadowfaxMetricsForTests();
  });

  it('fixes mismatched status', async () => {
    findAll.mockResolvedValue([
      { id: 'order-1', status: 'rider_assigned', shadowfaxOrderId: 123 } as never,
    ]);
    fetchStatus.mockResolvedValue({
      status: 'DISPATCHED',
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'rider_assigned',
      newStatus: 'picked_up',
    });

    const result = await runShadowfaxReconciliation();

    expect(result.fixed).toBe(1);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        toStatus: 'picked_up',
        source: 'shadowfax_reconciliation',
      }),
    );
  });
});
