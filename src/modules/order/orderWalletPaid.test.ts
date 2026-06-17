import { describe, it, expect } from 'vitest';
import {
  orderIdFromWalletReference,
  resolveWalletAmountPaid,
  resolveWalletAmountPaidFromPayments,
} from './orderWalletPaid';

describe('orderWalletPaid', () => {
  it('parses wallet reference formats', () => {
    expect(orderIdFromWalletReference('wallet_pay_order_abc-123')).toBe('abc-123');
    expect(orderIdFromWalletReference('order_abc-123')).toBe('abc-123');
    expect(orderIdFromWalletReference('other')).toBeNull();
  });

  it('reads wallet amount from captured payment metadata', () => {
    expect(
      resolveWalletAmountPaidFromPayments([
        { status: 'pending', metadata: { walletAmount: 50 } },
        { status: 'captured', metadata: { walletAmount: 100 } },
      ]),
    ).toBe(100);
  });

  it('prefers wallet transaction map over payment metadata', () => {
    const map = new Map([['order-1', 250]]);
    expect(
      resolveWalletAmountPaid(
        'order-1',
        [{ status: 'captured', metadata: { walletAmount: 100 } }],
        map,
      ),
    ).toBe(250);
  });
});
