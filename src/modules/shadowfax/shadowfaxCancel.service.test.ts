import { describe, it, expect, vi, beforeEach } from 'vitest';
import Order from '@modules/order/order.model';
import ShadowfaxShipment from './shadowfax-shipment.model';
import shadowfaxClient from './shadowfax.client';
import { cancelShadowfaxOrderForFinstyOrder } from './shadowfaxCancel.service';

vi.mock('@modules/order/order.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('./shadowfax-shipment.model', () => ({
  default: { findOne: vi.fn() },
}));

vi.mock('./shadowfax.client', () => ({
  default: { cancelOrder: vi.fn() },
}));

const orderFindByPk = vi.mocked(Order.findByPk);
const shipmentFindOne = vi.mocked(ShadowfaxShipment.findOne);
const cancelOrder = vi.mocked(shadowfaxClient.cancelOrder);

describe('shadowfaxCancel.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Shadowfax cancel for a placed delivery shipment', async () => {
    orderFindByPk.mockResolvedValue({ deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '21043840',
    } as ShadowfaxShipment);
    cancelOrder.mockResolvedValue({ message: 'ok' });

    await cancelShadowfaxOrderForFinstyOrder('order-1', {
      user: 'Seller',
      reason: 'Seller missing items',
    });

    expect(cancelOrder).toHaveBeenCalledWith('21043840', {
      user: 'Seller',
      reason: 'Seller missing items',
    });
  });

  it('skips pickup orders', async () => {
    orderFindByPk.mockResolvedValue({ deliveryType: 'pickup' } as Order);

    await cancelShadowfaxOrderForFinstyOrder('order-1', {
      user: 'Customer',
      reason: 'Cancelled by customer',
    });

    expect(shipmentFindOne).not.toHaveBeenCalled();
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it('skips when Shadowfax order was never placed', async () => {
    orderFindByPk
      .mockResolvedValueOnce({ deliveryType: 'delivery' } as Order)
      .mockResolvedValueOnce({ deliveryType: 'delivery', shadowfaxOrderId: null } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'pending',
      shadowfaxOrderId: null,
    } as ShadowfaxShipment);

    await cancelShadowfaxOrderForFinstyOrder('order-1', {
      user: 'Customer',
      reason: 'Cancelled by customer',
    });

    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it('swallows upstream cancel errors', async () => {
    orderFindByPk.mockResolvedValue({ deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '21043840',
    } as ShadowfaxShipment);
    cancelOrder.mockRejectedValue(new Error('upstream failed'));

    await expect(
      cancelShadowfaxOrderForFinstyOrder('order-1', {
        user: 'Customer',
        reason: 'Cancelled by customer',
      }),
    ).resolves.toBeUndefined();
  });
});
