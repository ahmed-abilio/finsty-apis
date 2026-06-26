import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@config/database', () => ({
  default: {
    transaction: vi.fn((fn: (t: unknown) => Promise<unknown>) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
  },
}));

vi.mock('@modules/order/order.model', () => ({
  default: {
    findByPk: vi.fn(),
  },
}));

vi.mock('./order-status-history.repository', () => ({
  appendOrderStatusHistory: vi.fn(),
}));

vi.mock('./order-status.publisher', () => ({
  publishOrderStatusChanged: vi.fn(),
}));

import Order from '@modules/order/order.model';
import { appendOrderStatusHistory } from './order-status-history.repository';
import { publishOrderStatusChanged } from './order-status.publisher';
import { transitionOrderStatus } from './order-status-transition.service';

const findByPk = vi.mocked(Order.findByPk);
const appendHistory = vi.mocked(appendOrderStatusHistory);
const publish = vi.mocked(publishOrderStatusChanged);

describe('order-status-transition.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates status history and publishes on success', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'confirmed',
      update: vi.fn().mockResolvedValue(undefined),
    };
    findByPk.mockResolvedValue(order as never);

    const result = await transitionOrderStatus({
      orderId: 'order-1',
      toStatus: 'rider_assigned',
      source: 'shadowfax_webhook',
      payload: { test: true },
    });

    expect(result.applied).toBe(true);
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        oldStatus: 'confirmed',
        newStatus: 'rider_assigned',
        source: 'shadowfax_webhook',
      }),
    );
    expect(publish).toHaveBeenCalled();
  });

  it('rejects invalid transition', async () => {
    findByPk.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'delivered',
      update: vi.fn(),
    } as never);

    const result = await transitionOrderStatus({
      orderId: 'order-1',
      toStatus: 'picked_up',
      source: 'shadowfax_webhook',
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('invalid_transition');
    expect(appendHistory).not.toHaveBeenCalled();
  });

  it('allows Shadowfax skip from rider_assigned to picked_up via source', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'rider_assigned',
      update: vi.fn().mockResolvedValue(undefined),
    };
    findByPk.mockResolvedValue(order as never);

    const result = await transitionOrderStatus({
      orderId: 'order-1',
      toStatus: 'picked_up',
      source: 'shadowfax_webhook',
    });

    expect(result.applied).toBe(true);
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        oldStatus: 'rider_assigned',
        newStatus: 'picked_up',
      }),
    );
  });

  it('allows Shadowfax cancel from picked_up via source', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'picked_up',
      update: vi.fn().mockResolvedValue(undefined),
    };
    findByPk.mockResolvedValue(order as never);

    const result = await transitionOrderStatus({
      orderId: 'order-1',
      toStatus: 'cancelled',
      source: 'shadowfax_delivery_status',
    });

    expect(result.applied).toBe(true);
  });

  it('allows Shadowfax return from arrived via source', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'arrived',
      update: vi.fn().mockResolvedValue(undefined),
    };
    findByPk.mockResolvedValue(order as never);

    const result = await transitionOrderStatus({
      orderId: 'order-1',
      toStatus: 'returned',
      source: 'shadowfax_reconciliation',
    });

    expect(result.applied).toBe(true);
  });
});
