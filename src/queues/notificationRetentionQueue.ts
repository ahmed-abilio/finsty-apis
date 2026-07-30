import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';
import logger from '@utils/logger';

export const NOTIFICATION_RETENTION_QUEUE_NAME = 'notification-retention';
export const NOTIFICATION_RETENTION_JOB_NAME = 'purge-old-notifications';
export const NOTIFICATION_RETENTION_SCHEDULER_ID = NOTIFICATION_RETENTION_JOB_NAME;
export const NOTIFICATION_RETENTION_REPEAT_EVERY_MS = 24 * 60 * 60 * 1000;

const notificationRetentionQueue = new Queue(NOTIFICATION_RETENTION_QUEUE_NAME, getQueueOptions());

/**
 * Ensures a single daily retention job runs.
 * Legacy schedulers are removed on startup so restarts do not stack intervals.
 */
export async function scheduleNotificationRetentionJob(): Promise<void> {
  const legacyRepeatables = await notificationRetentionQueue.getRepeatableJobs();
  for (const repeatJob of legacyRepeatables) {
    await notificationRetentionQueue.removeRepeatableByKey(repeatJob.key);
  }

  const schedulers = await notificationRetentionQueue.getJobSchedulers();
  for (const scheduler of schedulers) {
    if (scheduler.key !== NOTIFICATION_RETENTION_SCHEDULER_ID) {
      await notificationRetentionQueue.removeJobScheduler(scheduler.key);
    }
  }

  await notificationRetentionQueue.upsertJobScheduler(
    NOTIFICATION_RETENTION_SCHEDULER_ID,
    { every: NOTIFICATION_RETENTION_REPEAT_EVERY_MS },
    { name: NOTIFICATION_RETENTION_JOB_NAME, data: {} },
  );

  logger.info(
    {
      everyMs: NOTIFICATION_RETENTION_REPEAT_EVERY_MS,
      schedulerId: NOTIFICATION_RETENTION_SCHEDULER_ID,
    },
    'Notification retention repeatable job scheduled',
  );
}

export default notificationRetentionQueue;
