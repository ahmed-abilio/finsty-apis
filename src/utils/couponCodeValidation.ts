/** Coupon codes: uppercase A-Z, digits, underscore, hyphen; 3–30 chars after trim. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

export const COUPON_CODE_VALIDATION_MESSAGE =
  'Coupon code must be 3–30 characters and contain only letters (A-Z), numbers, underscores (_), or hyphens (-)';

/** Trim whitespace and uppercase (e.g. " save10 " → "SAVE10"). */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Returns an error message when invalid, or null when valid. */
export function getCouponCodeValidationError(raw: string): string | null {
  const code = normalizeCouponCode(raw);
  if (!code) return 'Coupon code is required';
  if (!COUPON_CODE_PATTERN.test(code)) return COUPON_CODE_VALIDATION_MESSAGE;
  return null;
}

/** Normalizes and validates; throws Error with message when invalid. */
export function assertValidCouponCode(raw: string): string {
  const error = getCouponCodeValidationError(raw);
  if (error) throw new Error(error);
  return normalizeCouponCode(raw);
}
