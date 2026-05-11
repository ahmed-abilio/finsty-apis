import 'dotenv/config';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { getWorkerOptions } from '@config/bullmq';
import sequelize from '@config/database';
import Order from '@modules/order/order.model';
import OrderItem from '@modules/order/order-item.model';
import PendingOrder from '@modules/order/pending-order.model';

import ProductVariant from '@modules/product/product-variant.model';
import CouponUsage from '@modules/coupon/coupon-usage.model';
import { OrderJobData, ORDER_QUEUE_NAME } from './orderQueue';
import logger from '@utils/logger';

// ─── Business-logic error codes that must NOT be retried ─────────────────────

const NON_RETRYABLE_CODES = new Set([
  'INSUFFICIENT_STOCK',
  'VARIANT_NOT_FOUND',
  'ADDRESS_NOT_FOUND',
  'EMPTY_CART',
]);

// ─── Processor ───────────────────────────────────────────────────────────────

async function processCreateOrder(job: Job<OrderJobData>): Promise<void> {
  if (job.data.type !== 'create_order') return;

  const { userId, input, pendingId, pricing } = job.data;
  const { addressId, deliveryType, notes } = input;

  logger.info({ jobId: job.id, userId, pendingId }, 'Processing create-order job');

  // Mark as processing so the mobile app sees intermediate state
  await PendingOrder.update({ status: 'processing' }, { where: { id: pendingId } });

  const t = await sequelize.transaction();

  try {
    // ── 1. Lock product variants (SELECT … FOR UPDATE) ───────────────────────
    // Collecting all variant IDs that appear in the order.
    // LOCK.UPDATE serialises concurrent workers touching the same rows —
    // even if 100 jobs arrive simultaneously, stock is deducted sequentially.
    const variantIds = pricing.orderItems
      .filter((item) => item.variantId !== null)
      .map((item) => item.variantId as string);

    const variantMap = new Map<string, ProductVariant>();

    if (variantIds.length > 0) {
      const locked = await ProductVariant.findAll({
        where: { id: variantIds },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      for (const v of locked) {
        variantMap.set(v.id, v);
      }
    }

    // ── 2. Stock check ────────────────────────────────────────────────────────
    for (const item of pricing.orderItems) {
      if (!item.variantId) continue;

      const variant = variantMap.get(item.variantId);

      if (!variant) {
        const err = new Error(`Variant ${item.variantId} not found`) as Error & { code: string };
        err.code = 'VARIANT_NOT_FOUND';
        throw err;
      }

      if (variant.stock < item.quantity) {
        const err = new Error(
          `Only ${variant.stock} unit(s) available for "${item.productName}"`,
        ) as Error & { code: string };
        err.code = 'INSUFFICIENT_STOCK';
        throw err;
      }
    }

    // ── 3. Deduct stock ───────────────────────────────────────────────────────
    for (const item of pricing.orderItems) {
      if (!item.variantId) continue;
      const variant = variantMap.get(item.variantId)!;
      await variant.update({ stock: variant.stock - item.quantity }, { transaction: t });
    }

    // ── 4. Create the Order row ───────────────────────────────────────────────
    const order = await Order.create(
      {
        userId,
        addressId: addressId ?? null,
        status: 'pending',
        deliveryType,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        deliveryCharge: pricing.deliveryCharge,
        totalAmount: pricing.totalAmount,
        notes: notes ?? null,
        originalBasePrice: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        couponCode: pricing.resolvedCouponCode,
        metadata: { cartItemIds: pricing.cartItemIds },
      },
      { transaction: t },
    );

    // ── 5. Bulk-create order items (snapshot of product/variant details) ──────
    const orderItemData = pricing.orderItems.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId ?? null,
      productName: item.productName,
      variantLabel: item.variantLabel ?? null,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
    }));

    await OrderItem.bulkCreate(orderItemData, { transaction: t });

    // ── 6. Record coupon usage ────────────────────────────────────────────────
    if (pricing.resolvedCouponId && pricing.resolvedCouponCode) {
      await CouponUsage.create(
        { couponId: pricing.resolvedCouponId, userId, orderId: order.id },
        { transaction: t },
      );
    }

    // ── 7. Cart clearing moved to payment capture ────────────────────────────
    // (Cart is now cleared only after successful payment)

    // ── 8. Commit ─────────────────────────────────────────────────────────────
    await t.commit();

    // ── 9. Mark success ───────────────────────────────────────────────────────
    await PendingOrder.update(
      { status: 'success', orderId: order.id },
      { where: { id: pendingId } },
    );

    logger.info({ jobId: job.id, pendingId, orderId: order.id }, 'Order created successfully');
  } catch (err) {
    await t.rollback();

    const code: string = (err as { code?: string }).code ?? 'ORDER_PROCESSING_FAILED';
    const message: string = (err as Error).message ?? 'Unexpected error';

    // Persist failure so the mobile app can surface it
    await PendingOrder.update(
      { status: 'failed', failureCode: code, failureMessage: message },
      { where: { id: pendingId } },
    ).catch((updateErr) => {
      logger.error({ updateErr }, 'Failed to update PendingOrder status to failed');
    });

    logger.error({ jobId: job.id, pendingId, code, message }, 'Order processing failed');

    // For business-logic failures (stock out, etc.) tell BullMQ never to retry —
    // retrying would not help and would mislead the buyer.
    if (NON_RETRYABLE_CODES.has(code)) {
      throw new UnrecoverableError(message);
    }

    // Re-throw transient errors so BullMQ applies its exponential back-off.
    throw err;
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<OrderJobData>(
  ORDER_QUEUE_NAME,
  async (job) => {
    switch (job.data.type) {
      case 'create_order':
        await processCreateOrder(job);
        break;
      default:
        logger.warn({ jobId: job.id, type: (job.data as { type?: string }).type }, 'Unknown order job type, skipping');
    }
  },
  getWorkerOptions(),
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, name: job.name }, 'Order job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, name: job?.name, err }, 'Order job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Order worker error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down order worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down order worker...');
  await worker.close();
  process.exit(0);
});

logger.info('Order worker started');

export default worker;
