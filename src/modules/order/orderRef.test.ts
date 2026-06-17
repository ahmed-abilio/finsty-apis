import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@modules/shadowfax/shadowfax-shipment.model', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import { buildOrderRefWhere } from './orderRef';

const findOne = vi.mocked(ShadowfaxShipment.findOne);

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
