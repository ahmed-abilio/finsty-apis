import { describe, it, expect, vi, beforeEach } from 'vitest';
import Order from './order.model';
import { markShadowfaxDispatchReadyForFinstyOrder } from '@modules/shadowfax/shadowfaxDispatchReady.service';
import { applyOrderDispatchReady } from './orderDispatchReady.service';

vi.mock('./order.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('@modules/shadowfax/shadowfaxDispatchReady.service', () => ({
  markShadowfaxDispatchReadyForFinstyOrder: vi.fn(),
}));

const orderFindByPk = vi.mocked(Order.findByPk);
const markDispatchReady = vi.mocked(markShadowfaxDispatchReadyForFinstyOrder);

describe('applyOrderDispatchReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Shadowfax and persists isDispatchReady on success', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    orderFindByPk.mockResolvedValue({
      id: 'order-1',
      isDispatchReady: false,
      update,
    } as unknown as Order);
    markDispatchReady.mockResolvedValue({ message: 'ok' });

    const body = { shipment_ready_timestamp: '2022-09-14T17:50:00Z' };
    const result = await applyOrderDispatchReady('order-1', body);

    expect(markDispatchReady).toHaveBeenCalledWith('order-1', body);
    expect(update).toHaveBeenCalledWith({ isDispatchReady: true });
    expect(result).toEqual({ message: 'ok' });
  });

  it('skips Shadowfax when already dispatch-ready', async () => {
    const update = vi.fn();
    orderFindByPk.mockResolvedValue({
      id: 'order-1',
      isDispatchReady: true,
      update,
    } as unknown as Order);

    const result = await applyOrderDispatchReady('order-1', {
      shipment_ready_timestamp: '2022-09-14T17:50:00Z',
    });

    expect(markDispatchReady).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'Already dispatch-ready' });
  });
});
