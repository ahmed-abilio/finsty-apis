import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';
import type { CreateOrderInput } from '@modules/order/order.checkout.types';
import type { ShadowfaxReplaySnapshot } from '@modules/shadowfax/shadowfaxDelivery';

export type { ShadowfaxReplaySnapshot } from '@modules/shadowfax/shadowfaxDelivery';

// ─── Snapshot types (fully serialisable — stored in Redis) ───────────────────

/**
 * Represents a single line-item as computed during fast-validation.
 * The worker uses this snapshot instead of re-fetching product data,
 * so the buyer always pays the price they saw.
 */
export interface OrderItemSnapshot {
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  /** Raw product base price (per unit, before discount and variant adjustment). */
  basePrice: number;
  /** Effective discount percent (0 when outside the discount window). */
  discountPercent: number;
  /** Per-unit savings when the discount window is active (list line base+additional minus unitPrice). */
  discountAmount: number;
  /** Per-unit base after the same discount percent applied to the catalogue base (variant extra discounted separately, same percent). */
  discountedBasePrice: number;
  /** Variant.additionalPrice per unit before discount (0 when the line has no variant). */
  additionalPrice: number;
  /** Final per-unit price: discounted base plus discounted variant additional. */
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  /** basePrice * quantity (true pre-discount, pre-variant total for this line). */
  baseTotal: number;
}

export interface ResolvedCouponLine {
  id: string;
  code: string;
  discountAmount: number;
}

/**
 * Complete pricing + cart snapshot attached to each job.
 * Built in the service during fast-validation so the worker
 * receives everything it needs without extra DB reads.
 */
export interface OrderPricingSnapshot {
  cartId: string;
  /** IDs of the CartItem rows to destroy inside the transaction */
  cartItemIds: string[];
  orderItems: OrderItemSnapshot[];
  subtotal: number;
  taxAmount: number;
  platformFee: number;
  deliveryCharge: number;
  totalAmount: number;
  discountAmount: number;
  /** Coupons applied at checkout; omit on older queued jobs (legacy `resolvedCouponId` / `resolvedCouponCode`). */
  resolvedCoupons?: ResolvedCouponLine[];
  /** Present when `deliveryType` is `delivery` — replayed at payment for Shadowfax validation. */
  shadowfaxReplay: ShadowfaxReplaySnapshot | null;
}

// ─── Job payload types ────────────────────────────────────────────────────────

export interface CreateOrderJob {
  type: 'create_order';
  userId: string;
  /** Original HTTP input — kept so the worker can reference deliveryType / notes */
  input: CreateOrderInput;
  /** PendingOrder.id — used to report back success / failure status */
  pendingId: string;
  pricing: OrderPricingSnapshot;
}

export type OrderJobData = CreateOrderJob;

// ─── Queue singleton ──────────────────────────────────────────────────────────

export const ORDER_QUEUE_NAME = 'order';

const orderQueue = new Queue<OrderJobData>(ORDER_QUEUE_NAME, getQueueOptions());

// ─── Job helpers ──────────────────────────────────────────────────────────────

/**
 * Enqueue a create-order job and return the BullMQ job ID.
 */
export async function addCreateOrderJob(
  userId: string,
  input: CreateOrderInput,
  pendingId: string,
  pricing: OrderPricingSnapshot,
): Promise<string> {
  const job = await orderQueue.add('create_order', {
    type: 'create_order',
    userId,
    input,
    pendingId,
    pricing,
  });
  return job.id!;
}

export default orderQueue;
