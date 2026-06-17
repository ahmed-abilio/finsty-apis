import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildPlaceOrderPayload,
  normalizeShadowfaxContactNumber,
  parsePlaceOrderResponse,
  resolvePickupPhone,
  resolveShadowfaxPlaceOrderValue,
  shadowfaxOrderItemId,
} from './shadowfaxPlaceOrder';
import type Order from '@modules/order/order.model';
import type Store from '@modules/store/store.model';
import type Address from '@modules/address/address.model';
import type OrderItem from '@modules/order/order-item.model';

describe('parsePlaceOrderResponse', () => {
  it('extracts track_url and order id from nested success payload', () => {
    const parsed = parsePlaceOrderResponse({
      success: true,
      data: {
        order_id: 'SFX-991',
        track_url: 'https://track.example/o/991',
        delivery_cost: 45.5,
      },
    });
    expect(parsed.shadowfaxOrderId).toBe('SFX-991');
    expect(parsed.trackUrl).toBe('https://track.example/o/991');
    expect(parsed.deliveryCost).toBe(45.5);
  });

  it('returns nulls for empty payload', () => {
    expect(parsePlaceOrderResponse(null)).toEqual({
      shadowfaxOrderId: null,
      trackUrl: null,
      deliveryCost: null,
    });
  });
});

describe('buildPlaceOrderPayload', () => {
  beforeEach(() => {
    vi.stubEnv('SHADOWFAX_CLIENT_CODE', 'awearofashion_mkt');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const order = {
    id: 'order-1',
    subtotal: 500,
    metadata: { shadowfaxReplay: { orderValue: '500.00', paid: 'true' as const } },
  } as unknown as Order;

  const store = {
    name: 'Test Store',
    phone: '9876543210',
    address: 'Store Rd',
    addressLine2: null,
    city: 'Delhi',
    latitude: 28.58,
    longitude: 77.05,
  } as unknown as Store;

  const address = {
    receiverName: 'Customer',
    receiverPhone: '9987654321',
    line1: 'Flat 2',
    line2: 'Block A',
    city: 'Delhi',
    latitude: 28.59,
    longitude: 77.04,
  } as unknown as Address;

  const items = [
    {
      productId: 'prod-1',
      productName: 'Shirt',
      unitPrice: 250,
      quantity: 2,
    },
  ] as unknown as OrderItem[];

  it('maps Finsty order data to Shadowfax v2 shape (prepaid)', () => {
    const payload = buildPlaceOrderPayload({ order, store, address, items });
    expect(payload.client_code).toBe('awearofashion_mkt');
    expect(payload.order_details.client_order_id).toBe('order-1');
    expect(payload.order_details.paid).toBe(true);
    expect(payload.order_details.order_value).toBe(500);
    expect(payload.order_details.rain_flag).toBe(false);
    expect(payload.order_details.scheduled_time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(payload.pickup_details.name).toBe('Test Store');
    expect(payload.drop_details.contact_number).toBe('9987654321');
    expect(payload.order_items).toHaveLength(1);
    expect(payload.order_items[0]).toMatchObject({
      name: 'Shirt',
      price: 250,
      quantity: 2,
    });
    expect(payload.order_items[0]!.id).toMatch(/^\d+$/);
  });

  it('COD orders use merchandise total as order_value', () => {
    const codOrder = {
      ...order,
      metadata: { shadowfaxReplay: { orderValue: '500.00', paid: 'false' as const } },
    } as unknown as Order;
    const payload = buildPlaceOrderPayload({
      order: codOrder,
      store,
      address,
      items,
    });
    expect(payload.order_details.paid).toBe(false);
    expect(payload.order_details.order_value).toBe(500);
  });
});

describe('resolveShadowfaxPlaceOrderValue', () => {
  it('returns sum of line items', () => {
    expect(
      resolveShadowfaxPlaceOrderValue([
        { unitPrice: 108, quantity: 1 },
        { unitPrice: 50, quantity: 2 },
      ]),
    ).toBe(208);
  });
});

describe('normalizeShadowfaxContactNumber', () => {
  it('strips +91 country code', () => {
    expect(normalizeShadowfaxContactNumber('+919121191211')).toBe('9121191211');
  });
});

describe('shadowfaxOrderItemId', () => {
  it('uses digits from uuid', () => {
    expect(shadowfaxOrderItemId('c26a0edc-7add-4580-b9be-56460e82f71f', 0)).toMatch(/^\d+$/);
  });
});

describe('resolvePickupPhone', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses store phone when present', () => {
    const store = { phone: ' 9111111111 ' } as Store;
    expect(resolvePickupPhone(store)).toBe('9111111111');
  });

  it('falls back to SHADOWFAX_PICKUP_CONTACT', () => {
    vi.stubEnv('SHADOWFAX_PICKUP_CONTACT', '9000000000');
    const store = { phone: null } as Store;
    expect(resolvePickupPhone(store)).toBe('9000000000');
  });
});
