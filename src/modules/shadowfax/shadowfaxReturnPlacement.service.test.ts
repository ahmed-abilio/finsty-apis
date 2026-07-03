import { describe, it, expect, vi, beforeEach } from 'vitest';

const { applyOrderDispatchReady } = vi.hoisted(() => ({
  applyOrderDispatchReady: vi.fn().mockResolvedValue({ message: 'ok' }),
}));

vi.mock('@modules/order/orderDispatchReady.service', () => ({
  applyOrderDispatchReady,
}));

vi.mock('@modules/order/order.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('@modules/order/order-item.model', () => ({
  default: { findAll: vi.fn(), findOne: vi.fn() },
}));

vi.mock('@modules/order/order-return.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('@modules/address/address.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('@modules/store/store.model', () => ({
  default: { findByPk: vi.fn() },
}));

vi.mock('./shadowfax-return-shipment.model', () => ({
  default: { findOne: vi.fn(), findOrCreate: vi.fn() },
}));

vi.mock('./shadowfax.client', () => ({
  default: { placeOrder: vi.fn() },
}));

vi.mock('./shadowfax.config', () => ({
  tryGetShadowfaxClientCode: vi.fn(() => 'client-code'),
}));

vi.mock('./shadowfaxPlaceOrder', () => ({
  buildReturnPlaceOrderPayload: vi.fn(() => ({})),
  getShadowfaxReplayFromOrder: vi.fn(() => ({ paid: 'true', orderValue: 100 })),
  parsePlaceOrderResponse: vi.fn(() => ({
    shadowfaxOrderId: '9260127',
    trackUrl: 'https://track.example',
    deliveryCost: null,
  })),
}));

vi.mock('@queues/shadowfaxQueue', () => ({
  enqueueShadowfaxReturnPlacementJob: vi.fn(),
}));

vi.mock('@modules/order/order-return-item.model', () => ({
  default: { findAll: vi.fn() },
}));

import Order from '@modules/order/order.model';
import OrderItem from '@modules/order/order-item.model';
import OrderReturn from '@modules/order/order-return.model';
import OrderReturnItem from '@modules/order/order-return-item.model';
import Address from '@modules/address/address.model';
import Store from '@modules/store/store.model';
import ShadowfaxReturnShipment from './shadowfax-return-shipment.model';
import shadowfaxClient from './shadowfax.client';
import { placeReturnOrderForFinstyReturn } from './shadowfaxReturnPlacement.service';

describe('placeReturnOrderForFinstyReturn dispatch-ready hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyOrderDispatchReady.mockResolvedValue({ message: 'ok' });
  });

  it('schedules dispatch-ready on parent order after return placement succeeds', async () => {
    const orderReturnUpdate = vi.fn().mockResolvedValue(undefined);
    const shipmentUpdate = vi.fn().mockResolvedValue(undefined);

    vi.mocked(OrderReturn.findByPk).mockResolvedValue({
      id: 'return-1',
      orderId: 'order-1',
      storeId: 'store-1',
      update: orderReturnUpdate,
    } as unknown as OrderReturn);

    vi.mocked(ShadowfaxReturnShipment.findOne).mockResolvedValue({
      status: 'pending',
      attemptCount: 0,
      update: shipmentUpdate,
    } as unknown as ShadowfaxReturnShipment);

    vi.mocked(Order.findByPk).mockResolvedValue({
      id: 'order-1',
      addressId: 'addr-1',
      deliveryType: 'delivery',
    } as unknown as Order);

    vi.mocked(Address.findByPk).mockResolvedValue({
      latitude: 12.9,
      longitude: 77.6,
    } as unknown as Address);

    vi.mocked(OrderReturnItem.findAll).mockResolvedValue([
      {
        unitPrice: 100,
        quantity: 1,
        orderItem: {
          productId: 'prod-1',
          productName: 'Shirt',
        },
      },
    ] as unknown as OrderReturnItem[]);

    vi.mocked(Store.findByPk).mockResolvedValue({
      latitude: 12.8,
      longitude: 77.5,
      phone: '+911234567890',
    } as unknown as Store);

    vi.mocked(shadowfaxClient.placeOrder).mockResolvedValue({
      data: { sfx_order_id: '9260127', track_url: 'https://track.example' },
    });

    await placeReturnOrderForFinstyReturn('return-1');
    await new Promise((resolve) => setImmediate(resolve));

    expect(orderReturnUpdate).toHaveBeenCalled();
    expect(applyOrderDispatchReady).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        shipment_ready_timestamp: expect.any(String),
      }),
    );
  });
});
