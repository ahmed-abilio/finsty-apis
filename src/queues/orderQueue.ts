import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';
import type { CreateOrderInput } from '@modules/order/order.service';

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
  unitPrice: number;
  quantity: number;
  totalPrice: number;
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
  deliveryCharge: number;
  totalAmount: number;
  discountAmount: number;
  resolvedCouponCode: string | null;
  resolvedCouponId: string | null;
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
