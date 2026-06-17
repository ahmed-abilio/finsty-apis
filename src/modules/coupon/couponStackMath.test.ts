import { describe, it, expect } from 'vitest';
import { computeMoneyDiscount, stackMoneyDiscounts } from './couponStackMath';

describe('computeMoneyDiscount', () => {
  it('FLAT respects remaining subtotal', () => {
    expect(computeMoneyDiscount('FLAT', 30, null, 100)).toBe(30);
    expect(computeMoneyDiscount('FLAT', 150, null, 100)).toBe(100);
  });

  it('PERCENTAGE uses remaining and cap', () => {
    expect(computeMoneyDiscount('PERCENTAGE', 10, null, 100)).toBe(10);
    expect(computeMoneyDiscount('PERCENTAGE', 50, 20, 100)).toBe(20);
  });

  it('sequential stack matches hand calculation', () => {
    let remaining = 100;
    const d1 = computeMoneyDiscount('FLAT', 30, null, remaining);
    remaining = Math.max(0, parseFloat((remaining - d1).toFixed(2)));
    const d2 = computeMoneyDiscount('PERCENTAGE', 10, null, remaining);
    expect(d1 + d2).toBe(37);
  });

  it('FREE_DELIVERY returns 0 money discount', () => {
    expect(computeMoneyDiscount('FREE_DELIVERY', 0, null, 100)).toBe(0);
  });
});

describe('stackMoneyDiscounts', () => {
  it('FLAT then PERCENTAGE on remaining (validateStack parity)', () => {
    const { lineDiscounts, totalDiscount } = stackMoneyDiscounts(
      [
        { type: 'FLAT', value: 30, maxDiscountCap: null },
        { type: 'PERCENTAGE', value: 10, maxDiscountCap: null },
      ],
      100,
    );
    expect(lineDiscounts).toEqual([30, 7]);
    expect(totalDiscount).toBe(37);
  });

  it('FREE_DELIVERY contributes 0 to totalDiscount', () => {
    const { lineDiscounts, totalDiscount } = stackMoneyDiscounts(
      [
        { type: 'FLAT', value: 20, maxDiscountCap: null },
        { type: 'FREE_DELIVERY', value: 0, maxDiscountCap: null },
      ],
      100,
    );
    expect(lineDiscounts).toEqual([20, 0]);
    expect(totalDiscount).toBe(20);
  });
});
