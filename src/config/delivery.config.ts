/** Public delivery pricing rules for checkout / mobile clients. */
export function getPublicDeliveryConfig() {
  return {
    freeDeliveryRequiresCoupon: true,
  };
}

export type DeliveryWaivedReason = 'pickup' | 'free_delivery_coupon' | null;

/**
 * Explains why `deliveryCharge` is zero on a persisted order (best-effort from stored fields).
 */
export function resolveDeliveryWaivedReason(params: {
  deliveryType: 'delivery' | 'pickup';
  deliveryCharge: number;
  couponCode?: string | null;
}): DeliveryWaivedReason {
  const { deliveryType, deliveryCharge, couponCode } = params;
  if (deliveryType === 'pickup') return 'pickup';
  if (deliveryCharge > 0.01) return null;
  if (couponCode && couponCode.trim().length > 0) return 'free_delivery_coupon';
  return null;
}
