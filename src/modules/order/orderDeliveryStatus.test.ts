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

vi.mock('@modules/shadowfax/shadowfax-shipment.model', () => ({
  default: { findOne: vi.fn() },
}));

vi.mock('@modules/shadowfax/shadowfaxStatus.service', () => ({
  default: { fetchOrderStatus: vi.fn() },
}));

vi.mock('./orderRef', () => ({
  buildOrderRefWhere: vi.fn(async (ref: string) => ({ id: ref })),
}));

vi.mock('@modules/shadowfax/tracking/shadowfax-dev-local-callback.service', () => ({
  syncOrderFromShadowfaxStatusIfDevCallbackEnabled: vi.fn().mockResolvedValue({
    attempted: false,
    applied: false,
  }),
}));

import Order from './order.model';
import Store from '@modules/store/store.model';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import { syncOrderFromShadowfaxStatusIfDevCallbackEnabled } from '@modules/shadowfax/tracking/shadowfax-dev-local-callback.service';
import { getOrderDeliveryStatus } from './orderDeliveryStatus.service';

const orderFindOne = vi.mocked(Order.findOne);
const storeFindOne = vi.mocked(Store.findOne);
const shipmentFindOne = vi.mocked(ShadowfaxShipment.findOne);
const fetchOrderStatus = vi.mocked(shadowfaxStatusService.fetchOrderStatus);
const syncDevCallback = vi.mocked(syncOrderFromShadowfaxStatusIfDevCallbackEnabled);

const buyer = { userId: 'user-1', role: 'user' };
const vendor = { userId: 'vendor-1', role: 'vendor' };

describe('getOrderDeliveryStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when buyer order not found', async () => {
    orderFindOne.mockResolvedValue(null);
    await expect(getOrderDeliveryStatus('order-1', buyer)).rejects.toMatchObject({
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
    expect(orderFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', userId: 'user-1' } }),
    );
  });

  it('allows vendor to load delivery status for store orders', async () => {
    storeFindOne.mockResolvedValue({ id: 'store-1' } as Store);
    orderFindOne.mockResolvedValue({ id: 'order-1', deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '21042908',
      trackUrl: null,
    } as ShadowfaxShipment);
    fetchOrderStatus.mockResolvedValue({
      client_code: 'merchant001',
      status: 'DISPATCHED',
      sfx_order_id: 21042908,
      order_details: {} as never,
      drop_details: {} as never,
      order_items: [],
      track_url: 'https://track.example',
      pickup_details: {} as never,
    });

    const result = await getOrderDeliveryStatus('21042908', vendor);

    expect(storeFindOne).toHaveBeenCalledWith({ where: { ownerId: 'vendor-1' } });
    expect(result.status).toBe('DISPATCHED');
    expect(fetchOrderStatus).toHaveBeenCalledWith('21042908');
  });

  it('returns 400 for pickup orders', async () => {
    orderFindOne.mockResolvedValue({ id: 'order-1', deliveryType: 'pickup' } as Order);
    await expect(getOrderDeliveryStatus('order-1', buyer)).rejects.toMatchObject({
      statusCode: 400,
      code: 'DELIVERY_STATUS_NOT_APPLICABLE',
    });
  });

  it('returns 409 when Shadowfax shipment is not placed', async () => {
    orderFindOne.mockResolvedValue({ id: 'order-1', deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue(null);
    await expect(getOrderDeliveryStatus('order-1', buyer)).rejects.toMatchObject({
      statusCode: 409,
      code: 'SHADOWFAX_ORDER_NOT_PLACED',
    });
  });

  it('returns parsed Shadowfax status and fills track_url from shipment', async () => {
    orderFindOne.mockResolvedValue({ id: 'order-1', deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '20611002',
      trackUrl: 'https://track.example/abc',
    } as ShadowfaxShipment);
    fetchOrderStatus.mockResolvedValue({
      client_code: 'merchant001',
      status: 'ALLOTTED',
      sfx_order_id: 20611002,
      order_details: {} as never,
      drop_details: {} as never,
      order_items: [],
      track_url: null,
      pickup_details: {} as never,
    });

    const result = await getOrderDeliveryStatus('order-1', buyer);
    expect(fetchOrderStatus).toHaveBeenCalledWith('20611002');
    expect(syncDevCallback).toHaveBeenCalledWith('order-1', expect.objectContaining({ status: 'ALLOTTED' }));
    expect(result.status).toBe('ALLOTTED');
    expect(result.track_url).toBe('https://track.example/abc');
  });

  it('rethrows AppError from upstream', async () => {
    orderFindOne.mockResolvedValue({ id: 'order-1', deliveryType: 'delivery' } as Order);
    shipmentFindOne.mockResolvedValue({
      status: 'placed',
      shadowfaxOrderId: '20611002',
      trackUrl: null,
    } as ShadowfaxShipment);
    fetchOrderStatus.mockRejectedValue(AppError.internal('Shadowfax down', 'SHADOWFAX_UNAVAILABLE'));

    await expect(getOrderDeliveryStatus('order-1', buyer)).rejects.toMatchObject({
      code: 'SHADOWFAX_UNAVAILABLE',
    });
  });
});
