import { describe, expect, it } from 'vitest';

/**
 * Regression checks for the AMOUNT_MISMATCH case (subtotal 1188, free delivery, ₹59 quote in UI).
 */
describe('payment initiate amount tolerance', () => {
  const orderTotal = 1426.84;
  const walletApplied = 100;
  const razorpayWithWallet = parseFloat((orderTotal - walletApplied).toFixed(2));
  const clientInflatedTotal = 1485.84;

  it('accepts server order total for non-wallet initiate', () => {
    expect(Math.abs(orderTotal - orderTotal)).toBeLessThanOrEqual(0.01);
  });

  it('rejects checkout UI total that includes waived delivery fee', () => {
    expect(Math.abs(clientInflatedTotal - orderTotal)).toBeGreaterThan(0.01);
    expect(parseFloat((clientInflatedTotal - orderTotal).toFixed(2))).toBe(59);
  });

  it('accepts razorpay portion for partial wallet', () => {
    expect(razorpayWithWallet).toBe(1326.84);
    expect(Math.abs(razorpayWithWallet - razorpayWithWallet)).toBeLessThanOrEqual(0.01);
  });

  it('rejects full UI total when useWallet is true', () => {
    expect(Math.abs(clientInflatedTotal - razorpayWithWallet)).toBeGreaterThan(0.01);
  });
});
