import 'dotenv/config';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { getWorkerOptions } from '@config/bullmq';
import sequelize from '@config/database';
import Order from '@modules/order/order.model';
import OrderItem from '@modules/order/order-item.model';
import PendingOrder from '@modules/order/pending-order.model';

import ProductVariant from '@modules/product/product-variant.model';
import { syncProductStockFromVariants } from '@modules/product/productStock.util';
import CouponUsage from '@modules/coupon/coupon-usage.model';
import { OrderJobData, ORDER_QUEUE_NAME, type OrderPricingSnapshot, type ResolvedCouponLine } from './orderQueue';
import logger from '@utils/logger';

function resolvedCouponsForWorker(pricing: OrderPricingSnapshot): ResolvedCouponLine[] {
  if (pricing.resolvedCoupons && pricing.resolvedCoupons.length > 0) {
    return pricing.resolvedCoupons;
  }
  const legacy = pricing as unknown as {
    resolvedCouponId?: string | null;
    resolvedCouponCode?: string | null;
  };
  if (legacy.resolvedCouponId && legacy.resolvedCouponCode) {
    return [
      {
        id: legacy.resolvedCouponId,
        code: legacy.resolvedCouponCode,
        discountAmount: Number(pricing.discountAmount ?? 0),
      },
    ];
  }
  return [];
}

// ─── Business-logic error codes that must NOT be retried ─────────────────────

const NON_RETRYABLE_CODES = new Set([
  'INSUFFICIENT_STOCK',
  'VARIANT_NOT_FOUND',
  'ADDRESS_NOT_FOUND',
  'EMPTY_CART',
]);

const ORDER_ID_MAX_RETRIES = 10;

function generatePublicOrderId(attempt = 0): string {
  const now = new Date();
  const epochPart = Date.now().toString(36).toUpperCase().slice(-6).padStart(6, '0');
  const msPart = String(now.getMilliseconds()).padStart(3, '0');
  const retryPart = Math.min(attempt, 35).toString(36).toUpperCase();
  return `FI${epochPart}${msPart}${retryPart}`;
}

function isOrderIdUniqueViolation(err: unknown): boolean {
  const sequelizeError = err as { name?: string; original?: { code?: string; constraint?: string } };
  return (
    sequelizeError?.name === 'SequelizeUniqueConstraintError' &&
    sequelizeError?.original?.code === '23505' &&
    sequelizeError?.original?.constraint === 'orders_order_id_key'
  );
}

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

    const stockedProductIds = [
      ...new Set(pricing.orderItems.map((item) => item.productId).filter(Boolean)),
    ];
    for (const productId of stockedProductIds) {
      await syncProductStockFromVariants(productId, t);
    }

    // True pre-discount, pre-variant-adjustment total — what the catalogue lists
    // before any promotion or variant surcharge is applied.
    const originalBasePrice = parseFloat(
      pricing.orderItems
        .reduce((acc, item) => acc + Number(item.baseTotal ?? 0), 0)
        .toFixed(2),
    );

    const resolvedCoupons = resolvedCouponsForWorker(pricing);

    // ── 4. Create the Order row ───────────────────────────────────────────────
    let order: Order | null = null;
    for (let attempt = 1; attempt <= ORDER_ID_MAX_RETRIES; attempt += 1) {
      try {
        order = await Order.create(
          {
            orderId: generatePublicOrderId(attempt - 1),
            userId,
            addressId: addressId ?? null,
            status: 'pending',
            deliveryType,
            subtotal: pricing.subtotal,
            taxAmount: pricing.taxAmount,
            platformFee: pricing.platformFee ?? 0,
            deliveryCharge: pricing.deliveryCharge,
            totalAmount: pricing.totalAmount,
            notes: notes ?? null,
            originalBasePrice,
            discountAmount: pricing.discountAmount,
            couponCode:
              resolvedCoupons.length > 0
                ? resolvedCoupons
                    .map((c) => c.code)
                    .join(',')
                    .slice(0, 255) || null
                : null,
            metadata: {
              cartItemIds: pricing.cartItemIds,
              ...(pricing.shadowfaxReplay ? { shadowfaxReplay: pricing.shadowfaxReplay } : {}),
              ...(resolvedCoupons.length > 0
                ? {
                    appliedCoupons: resolvedCoupons.map((c) => ({
                      couponId: c.id,
                      code: c.code,
                      discountAmount: c.discountAmount,
                    })),
                  }
                : {}),
            },
          },
          { transaction: t },
        );
        break;
      } catch (err) {
        if (!isOrderIdUniqueViolation(err) || attempt === ORDER_ID_MAX_RETRIES) {
          throw err;
        }
      }
    }

    if (!order) {
      throw new Error('Failed to generate a unique order ID');
    }

    // ── 5. Bulk-create order items (snapshot of product/variant details) ──────
    const orderItemData = pricing.orderItems.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId ?? null,
      productName: item.productName,
      variantLabel: item.variantLabel ?? null,
      basePrice: item.basePrice,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      discountedBasePrice: item.discountedBasePrice,
      additionalPrice: item.additionalPrice,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
    }));

    await OrderItem.bulkCreate(orderItemData, { transaction: t });

    // ── 6. Record coupon usage ────────────────────────────────────────────────
    if (resolvedCoupons.length > 0) {
      await CouponUsage.bulkCreate(
        resolvedCoupons.map((c) => ({
          couponId: c.id,
          userId,
          orderId: order.id,
        })),
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
