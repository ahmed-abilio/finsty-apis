import { describe, expect, it } from 'vitest';
import Order from '@modules/order/order.model';
import { buildAmountMismatchContext } from './paymentAmountValidation';

describe('buildAmountMismatchContext', () => {
  it('hints coupon waiver when delivery is free via coupon', () => {
    const order = {
      deliveryType: 'delivery',
      subtotal: 1188,
      deliveryCharge: 0,
      totalAmount: 1426.84,
      couponCode: 'FREESHIP',
    } as Order;

    const ctx = buildAmountMismatchContext({
      order,
      clientAmount: 1485.84,
      suggestedAmount: 1426.84,
      useWallet: false,
    });

    expect(ctx.deliveryWaivedReason).toBe('free_delivery_coupon');
    expect(ctx.hint).toContain('coupon');
  });

  it('hints delivery quote when client overpays without coupon waiver', () => {
    const order = {
      deliveryType: 'delivery',
      subtotal: 1188,
      deliveryCharge: 59,
      totalAmount: 1485.84,
      couponCode: null,
    } as Order;

    const ctx = buildAmountMismatchContext({
      order,
      clientAmount: 1500,
      suggestedAmount: 1485.84,
      useWallet: false,
    });

    expect(ctx.deliveryWaivedReason).toBe(null);
    expect(ctx.hint).toContain('delivery-quote');
  });

  it('hints wallet razorpay portion for partial wallet', () => {
    const order = {
      deliveryType: 'delivery',
      subtotal: 1188,
      deliveryCharge: 59,
      totalAmount: 1485.84,
      couponCode: null,
    } as Order;

    const ctx = buildAmountMismatchContext({
      order,
      clientAmount: 1485.84,
      suggestedAmount: 1385.84,
      useWallet: true,
      walletAmount: 100,
    });

    expect(ctx.useWallet).toBe(true);
    expect(ctx.hint).toContain('Razorpay portion');
  });
});
