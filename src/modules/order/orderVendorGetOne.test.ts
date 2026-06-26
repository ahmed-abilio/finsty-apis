import { describe, it, expect, vi, beforeEach } from 'vitest';

const { orderFindOne, storeFindOne, maybeSync } = vi.hoisted(() => ({
  orderFindOne: vi.fn(),
  storeFindOne: vi.fn(),
  maybeSync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./order.model', () => ({
  default: { findOne: orderFindOne },
}));

vi.mock('./order-item.model', () => ({ default: {} }));
vi.mock('./pending-order.model', () => ({ default: {} }));
vi.mock('@modules/address/address.model', () => ({ default: {} }));
vi.mock('@modules/wallet/wallet.model', () => ({ default: {} }));
vi.mock('@modules/wallet/wallet-transaction.model', () => ({ default: {} }));
vi.mock('@modules/user/user.model', () => ({ default: {} }));
vi.mock('@modules/cart/cart-item.model', () => ({ default: {} }));
vi.mock('@modules/product/product.model', () => ({ default: {} }));
vi.mock('@modules/product/product-image.model', () => ({ default: {} }));
vi.mock('@modules/product/product-variant.model', () => ({ default: {} }));
vi.mock('@modules/product/product-color.model', () => ({ default: {} }));
vi.mock('@modules/product/product-color-image.model', () => ({ default: {} }));
vi.mock('@modules/product/product-review.model', () => ({ default: {} }));
vi.mock('@modules/product/product-review-image.model', () => ({ default: {} }));
vi.mock('@modules/payment/payment.model', () => ({ default: {} }));

vi.mock('@modules/store/store.model', () => ({
  default: { findOne: storeFindOne },
}));

vi.mock('@modules/coupon/coupon.service', () => ({ default: {} }));
vi.mock('@modules/cart/cart.service', () => ({ default: {} }));
vi.mock('@queues/orderQueue', () => ({ addCreateOrderJob: vi.fn() }));
vi.mock('@modules/delivery/deliveryQuote.service', () => ({ resolveDeliveryQuote: vi.fn() }));
vi.mock('@modules/address/address.service', () => ({ default: {} }));
vi.mock('@modules/shadowfax/shadowfaxDelivery', () => ({ buildShadowfaxReplayFromSubtotal: vi.fn() }));
vi.mock('@modules/shadowfax/shadowfaxPlacement.service', () => ({
  scheduleShadowfaxPlacementIfDelivery: vi.fn(),
}));
vi.mock('@modules/shadowfax/shadowfaxCancel.service', () => ({
  cancelShadowfaxOrderForFinstyOrder: vi.fn(),
}));
vi.mock('@modules/shadowfax/shadowfaxDispatchReady.service', () => ({
  markShadowfaxDispatchReadyForFinstyOrder: vi.fn(),
}));
vi.mock('./orderDeliveryStatus.service', () => ({ getOrderDeliveryStatus: vi.fn() }));
vi.mock('@modules/shadowfax/tracking/order-status-transition.service', () => ({
  transitionOrderStatus: vi.fn(),
}));
vi.mock('@modules/shadowfax/tracking/order-status.publisher', () => ({
  publishOrderStatusChanged: vi.fn(),
}));
vi.mock('@modules/product/productStock.util', () => ({ syncProductStockFromVariants: vi.fn() }));
vi.mock('@modules/notification/notification.service', () => ({ notifyUser: vi.fn() }));
vi.mock('@modules/notification/notification.order', () => ({
  notifyBuyerOrderStatus: vi.fn(),
  notifyPaymentCancelled: vi.fn(),
}));

vi.mock('@config/database', () => ({
  default: { escape: (v: string) => `'${v}'`, literal: (sql: string) => sql },
}));

vi.mock('./orderRef', () => ({
  buildOrderRefWhere: vi.fn(async (ref: string) => ({ id: ref })),
}));

vi.mock('./orderShadowfaxSync.service', () => ({
  maybeSyncOrderShadowfaxStatusForOrderDetail: (...args: unknown[]) => maybeSync(...args),
}));

vi.mock('./orderWalletPaid', () => ({
  buildWalletPaidByOrderIds: vi.fn().mockResolvedValue(new Map()),
  resolveWalletAmountPaid: vi.fn().mockReturnValue(0),
}));

vi.mock('./orderShadowfax', () => ({
  buildShadowfaxOrderIdByOrderIds: vi.fn().mockResolvedValue(new Map()),
  resolveShadowfaxOrderId: vi.fn().mockReturnValue(null),
}));

import type Order from './order.model';
import type Store from '@modules/store/store.model';
import orderService from './order.service';

function buildOrderRecord(): Order {
  return {
    id: 'order-1',
    deliveryType: 'delivery',
    status: 'rider_assigned',
    userId: 'buyer-1',
    toPublicJSON: () => ({
      id: 'order-1',
      deliveryType: 'delivery',
      status: 'rider_assigned',
      deliveryCharge: 0,
      couponCode: null,
      shadowfaxOrderId: null,
    }),
    items: [],
    address: null,
    payments: [],
    user: null,
    riderId: null,
    riderName: null,
    riderPhone: null,
    deliveryMetadata: null,
    cancelledAt: null,
  } as unknown as Order;
}

describe('getVendorOrderById Shadowfax sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSync.mockResolvedValue(undefined);
  });

  it('syncs Shadowfax status before loading the full vendor order', async () => {
    storeFindOne.mockResolvedValue({ id: 'store-1' } as Store);
    orderFindOne
      .mockResolvedValueOnce({
        id: 'order-1',
        deliveryType: 'delivery',
        status: 'rider_assigned',
      } as Order)
      .mockResolvedValueOnce(buildOrderRecord());

    await orderService.getVendorOrderById('order-1', 'vendor-1');

    expect(maybeSync).toHaveBeenCalledWith('order-1', 'delivery', 'rider_assigned');
    expect(maybeSync.mock.invocationCallOrder[0]).toBeLessThan(
      orderFindOne.mock.invocationCallOrder[1],
    );
    expect(orderFindOne).toHaveBeenCalledTimes(2);
    expect(orderFindOne.mock.calls[0]?.[0]).toMatchObject({
      attributes: ['id', 'deliveryType', 'status'],
    });
  });

  it('does not sync when vendor order stub is not found', async () => {
    storeFindOne.mockResolvedValue({ id: 'store-1' } as Store);
    orderFindOne.mockResolvedValue(null);

    await expect(orderService.getVendorOrderById('missing', 'vendor-1')).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });

    expect(maybeSync).not.toHaveBeenCalled();
    expect(orderFindOne).toHaveBeenCalledTimes(1);
  });
});
