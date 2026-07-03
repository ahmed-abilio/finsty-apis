import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./order-return.model', () => ({
  default: { findAll: vi.fn() },
  ACTIVE_ORDER_RETURN_STATUSES: ['requested', 'pending_inspection'],
}));

import OrderReturn from './order-return.model';
import { buildActiveReturnByOrderIds, resolveActiveReturn } from './orderReturnLookup';

const findAll = vi.mocked(OrderReturn.findAll);

describe('orderReturnLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for all order ids when no active returns exist', async () => {
    findAll.mockResolvedValue([]);

    const map = await buildActiveReturnByOrderIds(['order-1', 'order-2']);

    expect(map.get('order-1')).toBeNull();
    expect(map.get('order-2')).toBeNull();
  });

  it('maps active return id and shadowfax order id', async () => {
    findAll.mockResolvedValue([
      {
        id: 'return-1',
        orderId: 'order-1',
        shadowfaxOrderId: 'SFX-RETURN-99',
        requestedAt: new Date('2026-06-01'),
      },
    ] as never);

    const map = await buildActiveReturnByOrderIds(['order-1']);

    expect(map.get('order-1')).toEqual({
      id: 'return-1',
      shadowfaxOrderId: 'SFX-RETURN-99',
    });
  });

  it('picks the newest active return when multiple exist for one order', async () => {
    findAll.mockResolvedValue([
      {
        id: 'return-new',
        orderId: 'order-1',
        shadowfaxOrderId: 'SFX-NEW',
        requestedAt: new Date('2026-06-02'),
      },
      {
        id: 'return-old',
        orderId: 'order-1',
        shadowfaxOrderId: 'SFX-OLD',
        requestedAt: new Date('2026-06-01'),
      },
    ] as never);

    const map = await buildActiveReturnByOrderIds(['order-1']);

    expect(map.get('order-1')).toEqual({
      id: 'return-new',
      shadowfaxOrderId: 'SFX-NEW',
    });
  });

  it('resolveActiveReturn reads from preloaded map', () => {
    const map = new Map([
      ['order-1', { id: 'return-1', shadowfaxOrderId: 'SFX-1' }],
      ['order-2', null],
    ]);

    expect(resolveActiveReturn('order-1', map)).toEqual({
      id: 'return-1',
      shadowfaxOrderId: 'SFX-1',
    });
    expect(resolveActiveReturn('order-2', map)).toBeNull();
    expect(resolveActiveReturn('order-3', map)).toBeNull();
  });
});
