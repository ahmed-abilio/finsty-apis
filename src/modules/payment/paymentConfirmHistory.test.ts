import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  orderFindOne,
  walletFindOrCreate,
  walletFindOne,
  walletTransactionCreate,
  transitionOrderStatus,
} = vi.hoisted(() => ({
  orderFindOne: vi.fn(),
  walletFindOrCreate: vi.fn(),
  walletFindOne: vi.fn(),
  walletTransactionCreate: vi.fn(),
  transitionOrderStatus: vi.fn(),
}));

vi.mock('@modules/payment/payment.model', () => ({
  default: { create: vi.fn() },
  PaymentStatus: {},
}));
vi.mock('@modules/order/order.model', () => ({
  default: { findOne: orderFindOne },
}));
vi.mock('@modules/user/user.model', () => ({ default: {} }));
vi.mock('@modules/wallet/wallet.model', () => ({
  default: { findOrCreate: walletFindOrCreate, findOne: walletFindOne },
}));
vi.mock('@modules/wallet/wallet-transaction.model', () => ({
  default: { create: walletTransactionCreate },
}));
vi.mock('@modules/cart/cart-item.model', () => ({ default: { destroy: vi.fn() } }));
vi.mock('@queues/emailQueue', () => ({ default: { add: vi.fn() } }));
vi.mock('@modules/order/orderDeliveryValidation', () => ({
  assertOrderDeliveryShadowfaxValidForPayment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@modules/shadowfax/shadowfaxPlacement.service', () => ({
  scheduleShadowfaxPlacementIfDelivery: vi.fn(),
}));
vi.mock('@utils/paymentAmountValidation', () => ({
  buildAmountMismatchContext: vi.fn(),
}));
vi.mock('@modules/notification/notification.service', () => ({
  formatOrderNumber: vi.fn(),
  notifyUser: vi.fn(),
}));
vi.mock('@modules/notification/notification.order', () => ({
  notifyBuyerOrderStatus: vi.fn(),
  notifyOrderPlacedAfterPayment: vi.fn().mockResolvedValue(undefined),
  notifyPaymentCancelled: vi.fn(),
}));
vi.mock('@modules/order/orderRef', () => ({
  buildOrderRefWhere: vi.fn(async (ref: string) => ({ id: ref })),
}));
vi.mock('@modules/shadowfax/tracking/order-status-transition.service', () => ({
  transitionOrderStatus,
}));
vi.mock('@modules/user/user.service', () => ({ default: {} }));
vi.mock('@utils/paymentProvider', () => ({
  paymentProvider: { initiate: vi.fn() },
}));

vi.mock('@config/database', () => ({
  default: {
    transaction: vi.fn().mockResolvedValue({
      commit: vi.fn(),
      rollback: vi.fn(),
      LOCK: { UPDATE: 'UPDATE' },
    }),
  },
}));

import paymentService from './payment.service';

describe('initiatePayment full-wallet path payment-confirm history unification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transitionOrderStatus.mockResolvedValue({
      applied: true,
      newStatus: 'confirmed',
      oldStatus: 'pending',
    });
  });

  it('routes pending -> confirmed through transitionOrderStatus with source "payment" when wallet covers the full order', async () => {
    walletFindOrCreate.mockResolvedValue([
      { id: 'wallet-1', balance: 500, isActive: true },
    ]);
    orderFindOne.mockResolvedValue({
      id: 'order-1',
      userId: 'buyer-1',
      status: 'pending',
      totalAmount: 500,
      deliveryType: 'pickup',
      metadata: null,
    });
    walletFindOne.mockResolvedValue({
      id: 'wallet-1',
      balance: 500,
      update: vi.fn().mockResolvedValue(undefined),
    });

    const result = await paymentService.initiatePayment('buyer-1', {
      orderId: 'order-1',
      useWallet: true,
    });

    expect(result.fullyPaidByWallet).toBe(true);
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
