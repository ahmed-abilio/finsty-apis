import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';

export const SHADOWFAX_QUEUE_NAME = 'shadowfax';

export interface PlaceShadowfaxOrderJob {
  type: 'place_shadowfax_order';
  orderId: string;
}

export interface ProcessShadowfaxWebhookJob {
  type: 'process_shadowfax_webhook';
  eventId: string;
}

export type ShadowfaxJobData = PlaceShadowfaxOrderJob | ProcessShadowfaxWebhookJob;

const shadowfaxQueue = new Queue<ShadowfaxJobData>(SHADOWFAX_QUEUE_NAME, getQueueOptions());

export async function enqueueShadowfaxPlacementJob(orderId: string): Promise<void> {
  await shadowfaxQueue.add(
    'place_shadowfax_order',
    { type: 'place_shadowfax_order', orderId },
    { jobId: `place-sfx-${orderId}` },
  );
}

export async function enqueueShadowfaxJob(data: ShadowfaxJobData): Promise<void> {
  if (data.type === 'place_shadowfax_order') {
    await enqueueShadowfaxPlacementJob(data.orderId);
    return;
  }
  await shadowfaxQueue.add('process_shadowfax_webhook', data, {
    jobId: `sfx-webhook-${data.eventId}`,
  });
}

export default shadowfaxQueue;
