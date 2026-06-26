import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@utils/appError';

vi.mock('./order.model', () => ({
  default: { findOne: vi.fn() },
}));

vi.mock('@modules/store/store.model', () => ({
  default: { findOne: vi.fn() },
}));

vi.mock('@config/database', () => ({
  default: { escape: (v: string) => `'${v}'`, literal: (sql: string) => sql },
}));

import Order from './order.model';
import Store from '@modules/store/store.model';
import { findOrderForCaller, resolveShadowfaxCancelActor } from './orderCallerAccess';

const orderFindOne = vi.mocked(Order.findOne);
const storeFindOne = vi.mocked(Store.findOne);

describe('findOrderForCaller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes buyer lookup to userId', async () => {
    orderFindOne.mockResolvedValue({ id: 'order-1' } as Order);

    const order = await findOrderForCaller({ id: 'order-1' }, { userId: 'buyer-1', role: 'user' });

    expect(order?.id).toBe('order-1');
    expect(orderFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', userId: 'buyer-1' } }),
    );
  });

  it('allows vendor to resolve store orders', async () => {
    storeFindOne.mockResolvedValue({ id: 'store-1' } as Store);
    orderFindOne.mockResolvedValue({ id: 'order-1' } as Order);

    const order = await findOrderForCaller({ id: 'order-1' }, { userId: 'vendor-1', role: 'vendor' });

    expect(order?.id).toBe('order-1');
    expect(storeFindOne).toHaveBeenCalledWith({ where: { ownerId: 'vendor-1' } });
  });

  it('returns null when vendor store has no matching order', async () => {
    storeFindOne.mockResolvedValue({ id: 'store-1' } as Store);
    orderFindOne.mockResolvedValue(null);

    const order = await findOrderForCaller({ id: 'order-1' }, { userId: 'vendor-1', role: 'vendor' });

    expect(order).toBeNull();
  });
});

describe('resolveShadowfaxCancelActor', () => {
  it('defaults buyer to Customer', () => {
    expect(resolveShadowfaxCancelActor('user')).toBe('Customer');
  });

  it('defaults vendor to Seller', () => {
    expect(resolveShadowfaxCancelActor('vendor')).toBe('Seller');
  });

  it('rejects vendor using Customer', () => {
    expect(() => resolveShadowfaxCancelActor('vendor', 'Customer')).toThrow(AppError);
    try {
      resolveShadowfaxCancelActor('vendor', 'Customer');
    } catch (err) {
      expect((err as AppError).code).toBe('INVALID_CANCEL_ACTOR');
    }
  });

  it('rejects buyer using Seller', () => {
    expect(() => resolveShadowfaxCancelActor('user', 'Seller')).toThrow(AppError);
    try {
      resolveShadowfaxCancelActor('user', 'Seller');
    } catch (err) {
      expect((err as AppError).code).toBe('INVALID_CANCEL_ACTOR');
    }
  });
});
