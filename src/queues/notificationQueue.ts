import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';
import type { NotificationContext, NotificationRole, NotificationType } from '@modules/notification/notification.types';

export interface PushNotificationJob {
  userId: string;
  role: NotificationRole;
  type: NotificationType;
  context: NotificationContext;
}

export const NOTIFICATION_QUEUE_NAME = 'push-notifications';

const notificationQueue = new Queue<PushNotificationJob>(NOTIFICATION_QUEUE_NAME, getQueueOptions());

export async function enqueuePushNotification(
  job: PushNotificationJob,
  options?: { delayMs?: number; jobId?: string },
): Promise<void> {
  const jobId =
    options?.jobId ??
    `push-${job.role}-${job.userId}-${job.type}-${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  await notificationQueue.add('send', job, {
    jobId,
    delay: options?.delayMs,
    removeOnComplete: true,
  });
}

export default notificationQueue;
