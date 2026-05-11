import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';
import logger from '@utils/logger';

export const ORDER_EXPIRY_QUEUE_NAME = 'order-expiry';
export const ORDER_EXPIRY_JOB_NAME = 'expire-pending-orders';
export const ORDER_EXPIRY_SCHEDULER_ID = ORDER_EXPIRY_JOB_NAME;
export const ORDER_EXPIRY_REPEAT_EVERY_MS = 10 * 60 * 1000;

const orderExpiryQueue = new Queue(ORDER_EXPIRY_QUEUE_NAME, getQueueOptions());

/**
 * Ensures a single repeatable expiry job runs every 10 minutes.
 * Legacy repeat schedulers are removed on startup so dev restarts do not stack intervals.
 */
export async function scheduleOrderExpiryJob(): Promise<void> {
  const legacyRepeatables = await orderExpiryQueue.getRepeatableJobs();
  for (const repeatJob of legacyRepeatables) {
    await orderExpiryQueue.removeRepeatableByKey(repeatJob.key);
  }

  const schedulers = await orderExpiryQueue.getJobSchedulers();
  for (const scheduler of schedulers) {
    if (scheduler.key !== ORDER_EXPIRY_SCHEDULER_ID) {
      await orderExpiryQueue.removeJobScheduler(scheduler.key);
    }
  }

  await orderExpiryQueue.upsertJobScheduler(
    ORDER_EXPIRY_SCHEDULER_ID,
    { every: ORDER_EXPIRY_REPEAT_EVERY_MS },
    { name: ORDER_EXPIRY_JOB_NAME, data: {} },
  );

  logger.info(
    { everyMs: ORDER_EXPIRY_REPEAT_EVERY_MS, schedulerId: ORDER_EXPIRY_SCHEDULER_ID },
    'Order expiry repeatable job scheduled',
  );
}

export default orderExpiryQueue;
