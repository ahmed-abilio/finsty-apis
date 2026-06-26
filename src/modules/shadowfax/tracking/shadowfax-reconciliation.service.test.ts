import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetShadowfaxMetricsForTests } from '@observability/shadowfax.metrics';

vi.mock('@modules/order/order.model', () => ({
  default: { findAll: vi.fn() },
}));

vi.mock('@modules/shadowfax/shadowfaxStatus.service', () => ({
  default: { fetchOrderStatus: vi.fn() },
}));

vi.mock('./order-rider-location.repository', () => ({
  deleteRiderLocationsOlderThan: vi.fn().mockResolvedValue(0),
}));

vi.mock('./shadowfax-dev-local-callback.service', () => ({
  syncOrderFromShadowfaxStatus: vi.fn(),
}));

import Order from '@modules/order/order.model';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import { syncOrderFromShadowfaxStatus } from './shadowfax-dev-local-callback.service';
import { runShadowfaxReconciliation } from './shadowfax-reconciliation.service';

const findAll = vi.mocked(Order.findAll);
const fetchStatus = vi.mocked(shadowfaxStatusService.fetchOrderStatus);
const syncStatus = vi.mocked(syncOrderFromShadowfaxStatus);

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
    syncStatus.mockResolvedValue({
      attempted: true,
      applied: true,
    });

    const result = await runShadowfaxReconciliation();

    expect(result.fixed).toBe(1);
    expect(syncStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'DISPATCHED' }),
      'shadowfax_reconciliation',
    );
  });

  it('reconciles confirmed orders when Shadowfax has advanced', async () => {
    findAll.mockResolvedValue([
      { id: 'order-2', status: 'confirmed', shadowfaxOrderId: 456 } as never,
    ]);
    fetchStatus.mockResolvedValue({
      status: 'ALLOTTED',
    } as never);
    syncStatus.mockResolvedValue({
      attempted: true,
      applied: true,
    });

    const result = await runShadowfaxReconciliation();

    expect(result.checked).toBe(1);
    expect(result.fixed).toBe(1);
    expect(syncStatus).toHaveBeenCalledWith(
      'order-2',
      expect.objectContaining({ status: 'ALLOTTED' }),
      'shadowfax_reconciliation',
    );
  });

  it('reconciles delivered orders when Shadowfax returns to seller', async () => {
    findAll.mockResolvedValue([
      { id: 'order-3', status: 'delivered', shadowfaxOrderId: 789 } as never,
    ]);
    fetchStatus.mockResolvedValue({
      status: 'RETURNED_TO_SELLER',
    } as never);
    syncStatus.mockResolvedValue({
      attempted: true,
      applied: true,
    });

    const result = await runShadowfaxReconciliation();

    expect(result.checked).toBe(1);
    expect(result.fixed).toBe(1);
    expect(syncStatus).toHaveBeenCalledWith(
      'order-3',
      expect.objectContaining({ status: 'RETURNED_TO_SELLER' }),
      'shadowfax_reconciliation',
    );
  });
});
