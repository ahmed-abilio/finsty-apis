import { describe, expect, it, vi } from 'vitest';
import type Address from '@modules/address/address.model';
import type Order from '@modules/order/order.model';
import type Store from '@modules/store/store.model';
import { buildReturnPlaceOrderPayload } from './shadowfaxPlaceOrder';

vi.mock('./shadowfax.config', () => ({
  getShadowfaxClientCode: () => 'TEST_CLIENT',
  getShadowfaxPickupContactFallback: () => '9999999999',
}));

describe('buildReturnPlaceOrderPayload', () => {
  it('swaps pickup and drop locations and uses return id as client_order_id', () => {
    const order = {
      id: 'order-uuid',
      metadata: { shadowfaxReplay: { orderValue: 100, paid: 'true', rainFlag: false } },
    } as Order;

    const store = {
      name: 'Test Store',
      phone: '9876543210',
      address: 'Store Line 1',
      addressLine2: null,
      latitude: 12.97,
      longitude: 77.59,
      city: 'Bengaluru',
    } as Store;

    const address = {
      receiverName: 'Customer',
      receiverPhone: '9123456789',
      line1: 'Home 12',
      line2: 'Apt 3',
      latitude: 12.95,
      longitude: 77.6,
      city: 'Bengaluru',
    } as Address;

    const payload = buildReturnPlaceOrderPayload({
      orderReturnId: 'return-uuid',
      order,
      store,
      address,
      items: [{ productId: 'prod-1', productName: 'Item A', unitPrice: 50, quantity: 1 }],
    });

    expect(payload.order_details.client_order_id).toBe('return-uuid');
    expect(payload.pickup_details.name).toBe('Customer');
    expect(payload.pickup_details.latitude).toBe(12.95);
    expect(payload.drop_details.name).toBe('Test Store');
    expect(payload.drop_details.latitude).toBe(12.97);
    expect(payload.order_items).toHaveLength(1);
    expect(payload.order_items[0].quantity).toBe(1);
  });
});
