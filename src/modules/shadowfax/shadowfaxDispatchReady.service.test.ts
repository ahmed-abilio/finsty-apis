import { describe, it, expect, vi, beforeEach } from 'vitest';
import Order from '@modules/order/order.model';
import { AppError } from '@utils/appError';
import ShadowfaxShipment from './shadowfax-shipment.model';
import shadowfaxClient from './shadowfax.client';
import { markShadowfaxDispatchReadyForFinstyOrder } from './shadowfaxDispatchReady.service';

vi.mock('@modules/order/order.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('./shadowfax-shipment.model', () => ({
  default: { findOne: vi.fn() },
}));

vi.mock('./shadowfax.client', () => ({
  default: { markDispatchReady: vi.fn() },
}));

const orderFindByPk = vi.mocked(Order.findByPk);
const shipmentFindOne = vi.mocked(ShadowfaxShipment.findOne);
const markDispatchReady = vi.mocked(shadowfaxClient.markDispatchReady);

describe('shadowfaxDispatchReady.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Shadowfax dispatch-ready for a placed delivery shipment', async () => {
    orderFindByPk.mockResolvedValue({ deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '9260127',
    } as ShadowfaxShipment);
    markDispatchReady.mockResolvedValue({ message: 'ok' });

    const body = { shipment_ready_timestamp: '2022-09-14T17:50:00Z' };
    const result = await markShadowfaxDispatchReadyForFinstyOrder('order-1', body);

    expect(markDispatchReady).toHaveBeenCalledWith('order-1', body);
    expect(result).toEqual({ message: 'ok' });
  });

  it('rejects pickup orders', async () => {
    orderFindByPk.mockResolvedValue({ deliveryType: 'pickup' } as Order);

    await expect(
      markShadowfaxDispatchReadyForFinstyOrder('order-1', {
        shipment_ready_timestamp: '2022-09-14T17:50:00Z',
      }),
    ).rejects.toMatchObject({
      code: 'DELIVERY_STATUS_NOT_APPLICABLE',
    });

    expect(markDispatchReady).not.toHaveBeenCalled();
  });

  it('throws when Shadowfax order was never placed', async () => {
    orderFindByPk
      .mockResolvedValueOnce({ deliveryType: 'delivery' } as Order)
      .mockResolvedValueOnce({ deliveryType: 'delivery', shadowfaxOrderId: null } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'pending',
      shadowfaxOrderId: null,
    } as ShadowfaxShipment);

    await expect(
      markShadowfaxDispatchReadyForFinstyOrder('order-1', {
        shipment_ready_timestamp: '2022-09-14T17:50:00Z',
      }),
    ).rejects.toMatchObject({
      code: 'SHADOWFAX_ORDER_NOT_PLACED',
    });

    expect(markDispatchReady).not.toHaveBeenCalled();
  });

  it('propagates upstream Shadowfax errors', async () => {
    orderFindByPk.mockResolvedValue({ deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '9260127',
    } as ShadowfaxShipment);
    markDispatchReady.mockRejectedValue(
      new AppError('Dispatch-ready rejected', 400, 'SHADOWFAX_UPSTREAM_ERROR'),
    );

    await expect(
      markShadowfaxDispatchReadyForFinstyOrder('order-1', {
        shipment_ready_timestamp: '2022-09-14T17:50:00Z',
      }),
    ).rejects.toMatchObject({
      code: 'SHADOWFAX_UPSTREAM_ERROR',
    });
  });
});
