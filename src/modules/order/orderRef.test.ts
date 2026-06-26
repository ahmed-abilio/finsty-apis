import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@modules/shadowfax/shadowfax-shipment.model', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('./order.model', () => ({
  default: { findOne: vi.fn() },
}));

vi.mock('@modules/user/user.model', () => ({
  default: { findByPk: vi.fn() },
}));

import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import Order from './order.model';
import User from '@modules/user/user.model';
import { buildOrderRefWhere, throwIfOrderRefLooksLikeUserId } from './orderRef';

const findOne = vi.mocked(ShadowfaxShipment.findOne);
const orderFindOne = vi.mocked(Order.findOne);
const userFindByPk = vi.mocked(User.findByPk);

describe('buildOrderRefWhere', () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it('uses primary key for UUID refs', async () => {
    const uuid = '62c23ffb-f8cb-4722-a26a-a88663c6f4aa';
    await expect(buildOrderRefWhere(uuid)).resolves.toEqual({ id: uuid });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('uses public order code column for FI refs', async () => {
    const code = 'FI0ABCDE1230';
    await expect(buildOrderRefWhere(code)).resolves.toEqual({ orderId: code });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('resolves Shadowfax order id via shipment table', async () => {
    findOne.mockResolvedValue({ orderId: 'order-uuid' } as never);
    await expect(buildOrderRefWhere('21042820')).resolves.toEqual({ id: 'order-uuid' });
    expect(findOne).toHaveBeenCalledWith({
      where: { shadowfaxOrderId: '21042820' },
      attributes: ['orderId'],
    });
  });

  it('falls back to public order code column for other refs', async () => {
    findOne.mockResolvedValue(null);
    await expect(buildOrderRefWhere('21042820')).resolves.toEqual({ orderId: '21042820' });
  });
});

describe('throwIfOrderRefLooksLikeUserId', () => {
  beforeEach(() => {
    orderFindOne.mockReset();
    userFindByPk.mockReset();
  });

  it('throws when UUID is a user id but not an order id', async () => {
    const userId = 'c3c34069-3cc7-4093-bb4f-6b54f6b1ddc3';
    orderFindOne.mockResolvedValue(null);
    userFindByPk.mockResolvedValue({ id: userId } as User);

    await expect(throwIfOrderRefLooksLikeUserId(userId)).rejects.toMatchObject({
      code: 'ORDER_REF_IS_USER_ID',
    });
  });

  it('does nothing when UUID is a valid order id', async () => {
    const orderId = 'a124ce11-585c-4c6f-b679-03d8a0835e9a';
    orderFindOne.mockResolvedValue({ id: orderId } as Order);

    await expect(throwIfOrderRefLooksLikeUserId(orderId)).resolves.toBeUndefined();
    expect(userFindByPk).not.toHaveBeenCalled();
  });
});
