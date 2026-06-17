import type { DeliveryType } from './order.model';

export interface CreateOrderInput {
  addressId?: string;
  deliveryType: DeliveryType;
  notes?: string;
  /** @deprecated Prefer `couponCodes` for multiple stackable coupons. */
  couponCode?: string;
  /** Multiple coupons in application order; when more than one code, each coupon must be `isStackable`. */
  couponCodes?: string[];
  autoApply?: boolean;
  /** Optional; server computes from Shadowfax. If sent, must match the applied charge from GET /cart/delivery-quote. */
  deliveryCharge?: number;
}
