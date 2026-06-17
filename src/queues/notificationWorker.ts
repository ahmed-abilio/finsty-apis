import 'dotenv/config';
import { Worker } from 'bullmq';
import { getWorkerOptions } from '@config/bullmq';
import { sendPushToUser } from '@modules/notification/notification.service';
import { NOTIFICATION_QUEUE_NAME, type PushNotificationJob } from './notificationQueue';
import logger from '@utils/logger';

const worker = new Worker<PushNotificationJob>(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    const { userId, role, type, context } = job.data;
    await sendPushToUser(userId, role, type, context ?? {});
  },
  getWorkerOptions(),
);

worker.on('completed', (job) => {
  logger.debug({ jobId: job.id, type: job.data.type }, 'Push notification job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err, type: job?.data?.type }, 'Push notification job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Push notification worker error');
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});

logger.info('Push notification worker started');

export default worker;
