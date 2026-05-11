import { QueueOptions, WorkerOptions } from 'bullmq';
import { createBullMQConnection } from '@config/redis';

const BULLMQ_PREFIX = process.env.REDIS_KEY_PREFIX ?? 'finsty';

export function getQueueOptions(): QueueOptions {
  return {
    connection: createBullMQConnection(),
    prefix: BULLMQ_PREFIX,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  };
}

export function getWorkerOptions(): Omit<WorkerOptions, 'connection'> & { connection: ReturnType<typeof createBullMQConnection> } {
  return {
    connection: createBullMQConnection(),
    prefix: BULLMQ_PREFIX,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  };
}
