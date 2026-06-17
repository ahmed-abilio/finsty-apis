import Product from '@modules/product/product.model';
import ProductVariant from '@modules/product/product-variant.model';

export interface LineItemPriceBreakdown {
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  discountedBasePrice: number;
  additionalPrice: number;
  unitPrice: number;
  itemTotal: number;
  baseTotal: number;
}

/**
 * Single source of truth for line-item pricing (cart, checkout snapshot, order items).
 *
 * The product's `discountPercent` applies only when `now` falls within
 * `[discountStartDate, discountEndDate]`. When active, the same percent is applied to
 * **both** the per-unit catalogue base and the variant's `additionalPrice` — i.e. to
 * `(basePrice + additionalPrice)` as a line, not base alone then add variant after discount.
 *
 * `discountedBasePrice` is the per-unit base after discount; the variant surcharge after
 * the same discount is `round(additionalPrice * (1 - discountPercent/100))` when the window
 * is valid, and `unitPrice` is the sum of those two rounded parts (equivalent to discounting
 * the combined list price, modulo 1-paisa rounding).
 */
export function computeLineItemPrice(
  product: Product,
  variant: ProductVariant | null | undefined,
  quantity: number,
): LineItemPriceBreakdown {
  const productRaw = (product as any).dataValues ?? {};
  const variantRaw = variant ? ((variant as any).dataValues ?? {}) : {};

  const basePrice = Number(
    product.basePrice ?? productRaw.basePrice ?? productRaw.base_price ?? 0,
  );
  const rawDiscountPercent = Number(
    product.discountPercent ??
      productRaw.discountPercent ??
      productRaw.discount_percent ??
      0,
  );

  const startDate =
    product.discountStartDate ??
    productRaw.discountStartDate ??
    productRaw.discount_start_date ??
    null;
  const endDate =
    product.discountEndDate ??
    productRaw.discountEndDate ??
    productRaw.discount_end_date ??
    null;

  const now = new Date();
  let isWindowValid = true;
  if (startDate && new Date(startDate) > now) isWindowValid = false;
  if (endDate && new Date(endDate) < now) isWindowValid = false;

  const discountPercent = isWindowValid ? rawDiscountPercent : 0;

  const additionalPrice = variant
    ? Number(
        variant.additionalPrice ??
          variantRaw.additionalPrice ??
          variantRaw.additional_price ??
          0,
      )
    : 0;

  const round = (n: number) => parseFloat(n.toFixed(2));

  const b = round(basePrice);
  const a = round(additionalPrice);
  const listUnit = round(b + a);

  let discountAmount: number;
  let discountedBasePrice: number;
  let unitPrice: number;

  if (discountPercent <= 0) {
    discountAmount = 0;
    discountedBasePrice = b;
    unitPrice = listUnit;
  } else {
    discountedBasePrice = round(b * (1 - discountPercent / 100));
    const discountedAdditional = round(a * (1 - discountPercent / 100));
    unitPrice = round(discountedBasePrice + discountedAdditional);
    discountAmount = round(listUnit - unitPrice);
  }

  const itemTotal = round(unitPrice * quantity);
  const baseTotal = round(basePrice * quantity);

  return {
    basePrice: b,
    discountPercent: round(discountPercent),
    discountAmount,
    discountedBasePrice,
    additionalPrice: a,
    unitPrice,
    itemTotal,
    baseTotal,
  };
}
