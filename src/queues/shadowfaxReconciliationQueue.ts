import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';
import logger from '@utils/logger';

export const SHADOWFAX_RECONCILIATION_QUEUE_NAME = 'shadowfax-reconciliation';
export const SHADOWFAX_RECONCILIATION_JOB_NAME = 'reconcile-shadowfax-orders';
export const SHADOWFAX_RECONCILIATION_SCHEDULER_ID = SHADOWFAX_RECONCILIATION_JOB_NAME;
export const SHADOWFAX_RECONCILIATION_EVERY_MS = 30 * 60 * 1000;

const shadowfaxReconciliationQueue = new Queue(
  SHADOWFAX_RECONCILIATION_QUEUE_NAME,
  getQueueOptions(),
);

const STALE_ACTIVE_JOB_MS = 40 * 60 * 1000;

async function clearStaleReconciliationJobs(): Promise<void> {
  const jobs = await shadowfaxReconciliationQueue.getJobs(['waiting', 'delayed', 'active']);
  let cleared = 0;

  for (const job of jobs) {
    if (job.name !== SHADOWFAX_RECONCILIATION_JOB_NAME) continue;

    const state = await job.getState();
    if (state === 'active') {
      const processedOn = job.processedOn ?? job.timestamp;
      const isStale = processedOn != null && Date.now() - processedOn > STALE_ACTIVE_JOB_MS;
      if (!isStale) {
        continue;
      }

      try {
        await job.moveToFailed(new Error('Cleared stale active reconciliation job on startup'), '0', false);
        cleared += 1;
      } catch {
        try {
          await job.remove();
          cleared += 1;
        } catch {
          // Still locked by a live worker — leave it alone.
        }
      }
      continue;
    }

    await job.remove();
    cleared += 1;
  }

  if (cleared > 0) {
    logger.info({ cleared }, 'Cleared stale Shadowfax reconciliation jobs');
  }
}

export async function scheduleShadowfaxReconciliationJob(): Promise<void> {
  const legacyRepeatables = await shadowfaxReconciliationQueue.getRepeatableJobs();
  for (const repeatJob of legacyRepeatables) {
    await shadowfaxReconciliationQueue.removeRepeatableByKey(repeatJob.key);
  }

  const schedulers = await shadowfaxReconciliationQueue.getJobSchedulers();
  for (const scheduler of schedulers) {
    if (scheduler.key !== SHADOWFAX_RECONCILIATION_SCHEDULER_ID) {
      await shadowfaxReconciliationQueue.removeJobScheduler(scheduler.key);
    }
  }

  await clearStaleReconciliationJobs();

  await shadowfaxReconciliationQueue.upsertJobScheduler(
    SHADOWFAX_RECONCILIATION_SCHEDULER_ID,
    { every: SHADOWFAX_RECONCILIATION_EVERY_MS },
    {
      name: SHADOWFAX_RECONCILIATION_JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: true,
        removeOnFail: 50,
      },
    },
  );

  logger.info(
    { everyMs: SHADOWFAX_RECONCILIATION_EVERY_MS },
    'Shadowfax reconciliation job scheduled',
  );
}

export default shadowfaxReconciliationQueue;
