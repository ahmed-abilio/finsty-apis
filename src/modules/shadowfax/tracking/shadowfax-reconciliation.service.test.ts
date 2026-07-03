import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetShadowfaxMetricsForTests } from '@observability/shadowfax.metrics';
import { AppError } from '@utils/appError';

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

  it('aborts the run early when Shadowfax is unreachable, without hammering remaining orders', async () => {
    findAll.mockResolvedValue([
      { id: 'order-1', status: 'confirmed', shadowfaxOrderId: 111 } as never,
      { id: 'order-2', status: 'confirmed', shadowfaxOrderId: 222 } as never,
      { id: 'order-3', status: 'confirmed', shadowfaxOrderId: 333 } as never,
    ]);
    fetchStatus.mockRejectedValue(
      AppError.internal('Unable to reach Shadowfax', 'SHADOWFAX_UNAVAILABLE'),
    );

    const result = await runShadowfaxReconciliation();

    expect(result.abortedUnreachable).toBe(true);
    expect(result.checked).toBe(1);
    expect(result.fixed).toBe(0);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(syncStatus).not.toHaveBeenCalled();
  });

  it('keeps checking remaining orders when a single order fails with a per-order upstream error', async () => {
    findAll.mockResolvedValue([
      { id: 'order-1', status: 'confirmed', shadowfaxOrderId: 111 } as never,
      { id: 'order-2', status: 'confirmed', shadowfaxOrderId: 222 } as never,
    ]);
    fetchStatus
      .mockRejectedValueOnce(new AppError('Order not found', 404, 'SHADOWFAX_UPSTREAM_ERROR'))
      .mockResolvedValueOnce({ status: 'ALLOTTED' } as never);
    syncStatus.mockResolvedValue({ attempted: true, applied: true });

    const result = await runShadowfaxReconciliation();

    expect(result.abortedUnreachable).toBe(false);
    expect(result.checked).toBe(2);
    expect(result.fixed).toBe(1);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
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
