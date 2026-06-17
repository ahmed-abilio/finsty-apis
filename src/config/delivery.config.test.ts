import { describe, it, expect } from 'vitest';
import { getPublicDeliveryConfig, resolveDeliveryWaivedReason } from './delivery.config';

describe('delivery.config', () => {
  it('getPublicDeliveryConfig requires coupon for free delivery', () => {
    expect(getPublicDeliveryConfig()).toEqual({ freeDeliveryRequiresCoupon: true });
  });

  it('resolveDeliveryWaivedReason returns pickup for pickup orders', () => {
    expect(
      resolveDeliveryWaivedReason({
        deliveryType: 'pickup',
        deliveryCharge: 0,
      }),
    ).toBe('pickup');
  });

  it('resolveDeliveryWaivedReason returns free_delivery_coupon when coupon present', () => {
    expect(
      resolveDeliveryWaivedReason({
        deliveryType: 'delivery',
        deliveryCharge: 0,
        couponCode: 'FREESHIP',
      }),
    ).toBe('free_delivery_coupon');
  });

  it('resolveDeliveryWaivedReason does not waive by subtotal alone', () => {
    expect(
      resolveDeliveryWaivedReason({
        deliveryType: 'delivery',
        deliveryCharge: 0,
      }),
    ).toBe(null);
  });

  it('resolveDeliveryWaivedReason returns null when delivery is charged', () => {
    expect(
      resolveDeliveryWaivedReason({
        deliveryType: 'delivery',
        deliveryCharge: 59,
      }),
    ).toBe(null);
  });
});
