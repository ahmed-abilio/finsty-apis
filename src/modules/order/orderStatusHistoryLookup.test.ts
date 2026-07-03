import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@modules/shadowfax/tracking/order-status-history.model', () => ({
  default: { findAll: vi.fn() },
}));

import OrderStatusHistory from '@modules/shadowfax/tracking/order-status-history.model';
import { buildOrderStatusHistoryByOrderIds } from './orderStatusHistoryLookup';

const findAll = vi.mocked(OrderStatusHistory.findAll);

describe('orderStatusHistoryLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty map for empty input without querying', async () => {
    const map = await buildOrderStatusHistoryByOrderIds([]);

    expect(map.size).toBe(0);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('returns an empty array for order ids with no history rows', async () => {
    findAll.mockResolvedValue([]);

    const map = await buildOrderStatusHistoryByOrderIds(['order-1', 'order-2']);

    expect(map.get('order-1')).toEqual([]);
    expect(map.get('order-2')).toEqual([]);
  });

  it('groups rows by orderId preserving query order', async () => {
    findAll.mockResolvedValue([
      {
        orderId: 'order-1',
        newStatus: 'confirmed',
        source: 'payment',
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
      },
      {
        orderId: 'order-1',
        newStatus: 'shipped',
        source: 'shadowfax_webhook',
        createdAt: new Date('2026-06-02T10:00:00.000Z'),
      },
      {
        orderId: 'order-2',
        newStatus: 'cancelled',
        source: 'user',
        createdAt: new Date('2026-06-03T10:00:00.000Z'),
      },
    ] as never);

    const map = await buildOrderStatusHistoryByOrderIds(['order-1', 'order-2']);

    expect(map.get('order-1')).toEqual([
      { status: 'confirmed', occurredAt: '2026-06-01T10:00:00.000Z', source: 'payment' },
      { status: 'shipped', occurredAt: '2026-06-02T10:00:00.000Z', source: 'shadowfax_webhook' },
    ]);
    expect(map.get('order-2')).toEqual([
      { status: 'cancelled', occurredAt: '2026-06-03T10:00:00.000Z', source: 'user' },
    ]);

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        order: [
          ['orderId', 'ASC'],
          ['createdAt', 'ASC'],
        ],
      }),
    );
  });

  it('includes rows for order ids that were not part of the requested list', async () => {
    findAll.mockResolvedValue([
      {
        orderId: 'order-unrequested',
        newStatus: 'confirmed',
        source: 'payment',
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
      },
    ] as never);

    const map = await buildOrderStatusHistoryByOrderIds(['order-1']);

    expect(map.get('order-1')).toEqual([]);
    expect(map.get('order-unrequested')).toEqual([
      { status: 'confirmed', occurredAt: '2026-06-01T10:00:00.000Z', source: 'payment' },
    ]);
  });
});
