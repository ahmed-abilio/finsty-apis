/**
 * GST / tax rate on merchandise subtotal (e.g. 0.18 for 18%).
 * @see process.env.TAX_RATE
 */
export function getTaxRate(): number {
  const r = parseFloat(process.env.TAX_RATE ?? '0.18');
  return Number.isFinite(r) && r >= 0 ? r : 0.18;
}

/**
 * Fixed platform fee per order in INR (not a percentage).
 * @see process.env.PLATFORM_FEE
 */
export function getPlatformFee(): number {
  const f = parseFloat(process.env.PLATFORM_FEE ?? '0');
  if (!Number.isFinite(f) || f < 0) return 0;
  return parseFloat(f.toFixed(2));
}

export function computeTaxOnSubtotal(subtotal: number): number {
  return parseFloat((subtotal * getTaxRate()).toFixed(2));
}
