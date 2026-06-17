import type { CouponType } from './coupon.model';

/**
 * Money-off part of a coupon on a given remaining subtotal (used for single-coupon and stacked checkout).
 * Keep in sync with CouponService stacking semantics.
 */
export function computeMoneyDiscount(
  type: CouponType,
  value: number,
  maxDiscountCap: number | null,
  remainingSubtotal: number,
): number {
  if (type === 'FREE_DELIVERY') return 0;

  if (type === 'FLAT') {
    return parseFloat(Math.min(value, remainingSubtotal).toFixed(2));
  }

  if (type === 'PERCENTAGE') {
    let discount = parseFloat(((remainingSubtotal * value) / 100).toFixed(2));
    if (maxDiscountCap !== null) {
      discount = Math.min(discount, maxDiscountCap);
    }
    return discount;
  }

  return 0;
}

export interface StackMoneyCouponInput {
  type: CouponType;
  value: number;
  maxDiscountCap: number | null;
}

/**
 * Sequential money discounts for a stack (FREE_DELIVERY lines contribute 0).
 * Matches CouponService.validateStack money-off semantics.
 */
export function stackMoneyDiscounts(
  coupons: StackMoneyCouponInput[],
  subtotal: number,
): { lineDiscounts: number[]; totalDiscount: number } {
  let remaining = parseFloat(Number(subtotal).toFixed(2));
  const lineDiscounts: number[] = [];
  let totalDiscount = 0;

  for (const coupon of coupons) {
    if (coupon.type === 'FREE_DELIVERY') {
      lineDiscounts.push(0);
      continue;
    }

    const lineDiscount = computeMoneyDiscount(
      coupon.type,
      coupon.value,
      coupon.maxDiscountCap,
      remaining,
    );
    lineDiscounts.push(lineDiscount);
    totalDiscount += lineDiscount;
    remaining = Math.max(0, parseFloat((remaining - lineDiscount).toFixed(2)));
  }

  totalDiscount = Math.min(parseFloat(totalDiscount.toFixed(2)), Number(subtotal));
  return { lineDiscounts, totalDiscount };
}
