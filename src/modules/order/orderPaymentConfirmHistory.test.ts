import { describe, it, expect, vi, beforeEach } from 'vitest';

const { orderFindOne, walletFindOne, transitionOrderStatus } = vi.hoisted(() => ({
  orderFindOne: vi.fn(),
  walletFindOne: vi.fn(),
  transitionOrderStatus: vi.fn(),
}));

vi.mock('./order.model', () => ({
  default: { findOne: orderFindOne },
}));

vi.mock('./order-item.model', () => ({ default: {} }));
vi.mock('./pending-order.model', () => ({ default: {} }));
vi.mock('@modules/address/address.model', () => ({ default: {} }));
vi.mock('@modules/wallet/wallet.model', () => ({ default: { findOne: walletFindOne } }));
vi.mock('@modules/wallet/wallet-transaction.model', () => ({ default: { create: vi.fn() } }));
vi.mock('@modules/user/user.model', () => ({
  default: {},
  Roles: { USER: 'user', VENDOR: 'vendor', ADMIN: 'admin' },
}));
vi.mock('@modules/user/user.service', () => ({ default: {} }));
vi.mock('@modules/cart/cart-item.model', () => ({ default: {} }));
vi.mock('@modules/product/product.model', () => ({ default: {} }));
vi.mock('@modules/product/product-image.model', () => ({ default: {} }));
vi.mock('@modules/product/product-variant.model', () => ({ default: {} }));
vi.mock('@modules/product/product-color.model', () => ({ default: {} }));
vi.mock('@modules/product/product-color-image.model', () => ({ default: {} }));
vi.mock('@modules/product/product-review.model', () => ({ default: {} }));
vi.mock('@modules/product/product-review-image.model', () => ({ default: {} }));
vi.mock('@modules/product/productStock.util', () => ({ syncProductStockFromVariants: vi.fn() }));
vi.mock('@modules/payment/payment.model', () => ({ default: {} }));

vi.mock('@modules/store/store.model', () => ({ default: { findOne: vi.fn() } }));

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
vi.mock('./orderDispatchReady.service', () => ({
  applyOrderDispatchReady: vi.fn(),
}));
vi.mock('@modules/shadowfax/shadowfaxDispatchReady.service', () => ({
  markShadowfaxDispatchReadyForFinstyOrder: vi.fn(),
}));
vi.mock('./orderDeliveryStatus.service', () => ({ getOrderDeliveryStatus: vi.fn() }));
vi.mock('./orderShadowfaxSync.service', () => ({
  maybeSyncOrderShadowfaxStatusForOrderDetail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@modules/shadowfax/tracking/order-status-transition.service', () => ({
  transitionOrderStatus,
}));
vi.mock('@modules/shadowfax/tracking/order-status.publisher', () => ({
  publishOrderStatusChanged: vi.fn(),
}));
vi.mock('@modules/notification/notification.service', () => ({ notifyUser: vi.fn() }));
vi.mock('@modules/notification/notification.order', () => ({
  notifyBuyerOrderStatus: vi.fn(),
  notifyPaymentCancelled: vi.fn(),
  notifyOrderPlacedAfterPayment: vi.fn(),
  notifyVendorsOrderCancelled: vi.fn(),
}));

vi.mock('@config/database', () => ({
  default: {
    escape: (v: string) => `'${v}'`,
    literal: (sql: string) => sql,
    transaction: vi.fn().mockResolvedValue({
      commit: vi.fn(),
      rollback: vi.fn(),
      LOCK: { UPDATE: 'UPDATE' },
    }),
  },
}));

vi.mock('./orderRef', () => ({
  buildOrderRefWhere: vi.fn(async (ref: string) => ({ id: ref })),
  throwIfOrderRefLooksLikeUserId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./orderReturnLookup', () => ({
  buildActiveReturnByOrderIds: vi.fn().mockResolvedValue(new Map()),
  resolveActiveReturn: vi.fn().mockReturnValue(null),
}));

vi.mock('./orderWalletPaid', () => ({
  buildWalletPaidByOrderIds: vi.fn().mockResolvedValue(new Map()),
  resolveWalletAmountPaid: vi.fn().mockReturnValue(0),
}));

vi.mock('./orderShadowfax', () => ({
  buildShadowfaxOrderIdByOrderIds: vi.fn().mockResolvedValue(new Map()),
  resolveShadowfaxOrderId: vi.fn().mockReturnValue(null),
}));

vi.mock('./orderStatusHistoryLookup', () => ({
  buildOrderStatusHistoryByOrderIds: vi.fn().mockResolvedValue(new Map()),
}));

import orderService from './order.service';

describe('payWithWallet payment-confirm history unification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transitionOrderStatus.mockResolvedValue({
      applied: true,
      newStatus: 'confirmed',
      oldStatus: 'pending',
    });
  });

  it('routes pending -> confirmed through transitionOrderStatus with source "payment"', async () => {
    orderFindOne.mockResolvedValue({
      id: 'order-1',
      userId: 'buyer-1',
      status: 'pending',
      deliveryType: 'pickup',
      totalAmount: 100,
      items: [],
      address: null,
      payments: [],
      toPublicJSON: () => ({
        id: 'order-1',
        status: 'confirmed',
        deliveryCharge: 0,
        couponCode: null,
        shadowfaxOrderId: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      }),
    });
    walletFindOne.mockResolvedValue({
      id: 'wallet-1',
      balance: 500,
      isActive: true,
      update: vi.fn().mockResolvedValue(undefined),
    });

    await orderService.payWithWallet('order-1', 'buyer-1');

    expect(transitionOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        toStatus: 'confirmed',
        source: 'payment',
        skipPublish: true,
      }),
    );
  });
});
