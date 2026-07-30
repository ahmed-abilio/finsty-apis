import 'dotenv/config';
import { Worker } from 'bullmq';
import { getScheduledJobWorkerOptions } from '@config/bullmq';
import notificationInboxService, {
  notificationRetentionCutoff,
} from '@modules/notification/notification.inbox.service';
import logger from '@utils/logger';
import { NOTIFICATION_RETENTION_QUEUE_NAME } from './notificationRetentionQueue';

const worker = new Worker(
  NOTIFICATION_RETENTION_QUEUE_NAME,
  async (job) => {
    const cutoff = notificationRetentionCutoff();
    const deleted = await notificationInboxService.deleteOlderThan(cutoff);

    logger.info(
      { jobId: job.id, deleted, cutoff: cutoff.toISOString() },
      'notification_retention_cleanup',
    );

    return { deleted, cutoff: cutoff.toISOString() };
  },
  getScheduledJobWorkerOptions(),
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Notification retention job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Notification retention job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Notification retention worker error');
});

async function shutdownWorker(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down notification retention worker...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdownWorker('SIGTERM'));
process.on('SIGINT', () => void shutdownWorker('SIGINT'));

logger.info('Notification retention worker started');

export default worker;
