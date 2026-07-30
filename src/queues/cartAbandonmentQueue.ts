import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';
import logger from '@utils/logger';

export const CART_ABANDONMENT_QUEUE_NAME = 'cart-abandonment';
export const CART_ABANDONMENT_JOB_NAME = 'remind-abandoned-carts';
export const CART_ABANDONMENT_SCHEDULER_ID = CART_ABANDONMENT_JOB_NAME;
export const CART_ABANDONMENT_REPEAT_EVERY_MS = Number(
  process.env.CART_ABANDON_REPEAT_EVERY_MS ?? 600_000,
);

const cartAbandonmentQueue = new Queue(CART_ABANDONMENT_QUEUE_NAME, getQueueOptions());

/**
 * Ensures a single repeatable cart-abandonment scan runs on an interval.
 * Legacy schedulers are removed on startup so restarts do not stack intervals.
 */
export async function scheduleCartAbandonmentJob(): Promise<void> {
  const legacyRepeatables = await cartAbandonmentQueue.getRepeatableJobs();
  for (const repeatJob of legacyRepeatables) {
    await cartAbandonmentQueue.removeRepeatableByKey(repeatJob.key);
  }

  const schedulers = await cartAbandonmentQueue.getJobSchedulers();
  for (const scheduler of schedulers) {
    if (scheduler.key !== CART_ABANDONMENT_SCHEDULER_ID) {
      await cartAbandonmentQueue.removeJobScheduler(scheduler.key);
    }
  }

  await cartAbandonmentQueue.upsertJobScheduler(
    CART_ABANDONMENT_SCHEDULER_ID,
    { every: CART_ABANDONMENT_REPEAT_EVERY_MS },
    { name: CART_ABANDONMENT_JOB_NAME, data: {} },
  );

  logger.info(
    {
      everyMs: CART_ABANDONMENT_REPEAT_EVERY_MS,
      schedulerId: CART_ABANDONMENT_SCHEDULER_ID,
    },
    'Cart abandonment repeatable job scheduled',
  );
}

export default cartAbandonmentQueue;
