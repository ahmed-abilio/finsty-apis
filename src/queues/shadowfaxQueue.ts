import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';

export const SHADOWFAX_QUEUE_NAME = 'shadowfax';

export interface PlaceShadowfaxOrderJob {
  type: 'place_shadowfax_order';
  orderId: string;
}

export interface PlaceShadowfaxReturnOrderJob {
  type: 'place_shadowfax_return_order';
  orderReturnId: string;
}

export interface ProcessShadowfaxWebhookJob {
  type: 'process_shadowfax_webhook';
  eventId: string;
}

export type ShadowfaxJobData =
  | PlaceShadowfaxOrderJob
  | PlaceShadowfaxReturnOrderJob
  | ProcessShadowfaxWebhookJob;

const shadowfaxQueue = new Queue<ShadowfaxJobData>(SHADOWFAX_QUEUE_NAME, getQueueOptions());

export async function enqueueShadowfaxPlacementJob(orderId: string): Promise<void> {
  await shadowfaxQueue.add(
    'place_shadowfax_order',
    { type: 'place_shadowfax_order', orderId },
    { jobId: `place-sfx-${orderId}` },
  );
}

export async function enqueueShadowfaxReturnPlacementJob(orderReturnId: string): Promise<void> {
  await shadowfaxQueue.add(
    'place_shadowfax_return_order',
    { type: 'place_shadowfax_return_order', orderReturnId },
    { jobId: `place-sfx-return-${orderReturnId}` },
  );
}

export async function enqueueShadowfaxJob(data: ShadowfaxJobData): Promise<void> {
  if (data.type === 'place_shadowfax_order') {
    await enqueueShadowfaxPlacementJob(data.orderId);
    return;
  }
  if (data.type === 'place_shadowfax_return_order') {
    await enqueueShadowfaxReturnPlacementJob(data.orderReturnId);
    return;
  }
  await shadowfaxQueue.add('process_shadowfax_webhook', data, {
    jobId: `sfx-webhook-${data.eventId}`,
  });
}

export default shadowfaxQueue;
