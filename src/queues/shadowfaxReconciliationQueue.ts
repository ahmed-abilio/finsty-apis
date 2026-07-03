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

/**
 * Best-effort cleanup of *orphaned* reconciliation runs left behind by a worker
 * that crashed mid-job. This is purely housekeeping and MUST never throw, or it
 * would crash server startup.
 *
 * Important production-safety notes:
 *  - We only reclaim `active` jobs that have been stuck longer than the stale
 *    threshold. A job actively owned by a live worker is locked; trying to remove
 *    it throws "locked by another worker". With multiple instances/workers this
 *    is expected, so any such error is caught and ignored.
 *  - We deliberately do NOT touch `waiting`/`delayed` jobs. The recurring
 *    `delayed` job is the scheduler's next iteration (`repeat:...`) and is managed
 *    idempotently by `upsertJobScheduler` below — removing it here is both
 *    unnecessary and the source of the lock crash.
 */
async function clearStaleReconciliationJobs(): Promise<void> {
  let jobs;
  try {
    jobs = await shadowfaxReconciliationQueue.getJobs(['active']);
  } catch (err) {
    logger.warn({ err }, 'Skipped Shadowfax reconciliation cleanup: could not list active jobs');
    return;
  }

  let cleared = 0;

  for (const job of jobs) {
    if (job.name !== SHADOWFAX_RECONCILIATION_JOB_NAME) continue;

    const processedOn = job.processedOn ?? job.timestamp;
    const isStale = processedOn != null && Date.now() - processedOn > STALE_ACTIVE_JOB_MS;
    if (!isStale) continue;

    try {
      await job.moveToFailed(
        new Error('Cleared stale active reconciliation job on startup'),
        '0',
        false,
      );
      cleared += 1;
    } catch (err) {
      // Job is locked by a live worker (normal with concurrent instances) or has
      // already moved on. Leave it alone — never crash startup over housekeeping.
      logger.warn(
        { err, jobId: job.id },
        'Skipped locked/in-flight Shadowfax reconciliation job during cleanup',
      );
    }
  }

  if (cleared > 0) {
    logger.info({ cleared }, 'Cleared stale Shadowfax reconciliation jobs');
  }
}

export async function scheduleShadowfaxReconciliationJob(): Promise<void> {
  // Remove stale/legacy schedulers so dev restarts and renamed jobs don't stack
  // intervals. These are best-effort: a key locked by another worker/instance
  // must not crash startup, since `upsertJobScheduler` below is idempotent.
  try {
    const legacyRepeatables = await shadowfaxReconciliationQueue.getRepeatableJobs();
    for (const repeatJob of legacyRepeatables) {
      try {
        await shadowfaxReconciliationQueue.removeRepeatableByKey(repeatJob.key);
      } catch (err) {
        logger.warn({ err, key: repeatJob.key }, 'Skipped removing locked legacy repeatable job');
      }
    }

    const schedulers = await shadowfaxReconciliationQueue.getJobSchedulers();
    for (const scheduler of schedulers) {
      if (scheduler.key === SHADOWFAX_RECONCILIATION_SCHEDULER_ID) continue;
      try {
        await shadowfaxReconciliationQueue.removeJobScheduler(scheduler.key);
      } catch (err) {
        logger.warn({ err, key: scheduler.key }, 'Skipped removing locked job scheduler');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Shadowfax reconciliation scheduler cleanup encountered an error; continuing');
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
