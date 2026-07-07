import { describe, expect, it } from 'vitest';
import {
  assertValidCouponCode,
  getCouponCodeValidationError,
  normalizeCouponCode,
} from './couponCodeValidation';

describe('couponCodeValidation', () => {
  it('trims and uppercases before validation', () => {
    expect(normalizeCouponCode('  save10  ')).toBe('SAVE10');
    expect(assertValidCouponCode('  save10  ')).toBe('SAVE10');
  });

  it('accepts valid codes', () => {
    const valid = ['SAVE10', 'WELCOME50', 'NEW_USER', 'SUMMER-2026', 'ABC123', 'DISCOUNT_25', 'SALE-50'];
    for (const code of valid) {
      expect(getCouponCodeValidationError(code)).toBeNull();
      expect(assertValidCouponCode(code)).toBe(code);
    }
  });

  it('rejects empty and whitespace-only', () => {
    expect(getCouponCodeValidationError('')).toMatch(/required/i);
    expect(getCouponCodeValidationError('   ')).toMatch(/required/i);
  });

  it('rejects too short codes', () => {
    expect(getCouponCodeValidationError('AB')).not.toBeNull();
    expect(getCouponCodeValidationError('  ab  ')).not.toBeNull();
  });

  it('rejects too long codes', () => {
    expect(
      getCouponCodeValidationError('THIS_IS_A_VERY_LONG_COUPON_CODE_EXCEEDING_30_CHARACTERS'),
    ).not.toBeNull();
  });

  it('rejects internal spaces and special characters', () => {
    const invalid = ['SAVE 10', 'SAVE@10', 'SAVE#10', 'SAVE$10', 'SAVE!10', 'SAVE%10', 'SAVE&10'];
    for (const code of invalid) {
      expect(getCouponCodeValidationError(code)).not.toBeNull();
    }
  });
});
