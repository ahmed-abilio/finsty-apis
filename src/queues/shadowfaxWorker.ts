import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { getWorkerOptions } from '@config/bullmq';
import { SHADOWFAX_QUEUE_NAME, type ShadowfaxJobData } from './shadowfaxQueue';
import { placeOrderForFinstyOrder } from '@modules/shadowfax/shadowfaxPlacement.service';
import { processShadowfaxWebhookEvent } from '@modules/shadowfax/tracking/shadowfax-webhook.processor';
import logger from '@utils/logger';

const NON_RETRYABLE_FAILURE_PREFIXES = [
  'Order is missing',
  'Delivery address',
  'Order has no line items',
  'Could not resolve store',
  'Store not found',
  'Invalid pickup',
  'Store pickup phone',
  'Failed to build',
  'Shadowfax client code is not configured',
  'placement skipped',
  'client_order_id',
];

async function processShadowfaxJob(job: Job<ShadowfaxJobData>): Promise<void> {
  if (job.data.type === 'process_shadowfax_webhook') {
    await processShadowfaxWebhookEvent(job.data.eventId);
    return;
  }

  if (job.data.type !== 'place_shadowfax_order') return;

  const { orderId } = job.data;
  logger.info({ jobId: job.id, orderId }, 'Processing Shadowfax placement job');

  await placeOrderForFinstyOrder(orderId);
}

const worker = new Worker<ShadowfaxJobData>(
  SHADOWFAX_QUEUE_NAME,
  async (job) => {
    try {
      await processShadowfaxJob(job);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (NON_RETRYABLE_FAILURE_PREFIXES.some((p) => message.includes(p))) {
        logger.warn({ jobId: job.id, message }, 'Shadowfax job failed (non-retryable)');
        return;
      }
      throw err;
    }
  },
  getWorkerOptions(),
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Shadowfax worker job failed');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Shadowfax worker job completed');
});

export default worker;
