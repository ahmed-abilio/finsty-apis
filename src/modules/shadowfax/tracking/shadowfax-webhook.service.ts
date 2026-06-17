import { enqueueShadowfaxJob } from '@queues/shadowfaxQueue';
import logger from '@utils/logger';
import { incrementShadowfaxMetric } from '@observability/shadowfax.metrics';
import {
  buildShadowfaxEventKey,
  extractClientOrderId,
  extractShadowfaxStatus,
  extractSfxOrderId,
} from './shadowfax-event-key';
import { insertWebhookEventIfNotExists } from './shadowfax-webhook-event.repository';
import type {
  ShadowfaxRiderLocationPayload,
  ShadowfaxWebhookPayload,
} from './shadowfax-webhook.types';
import { resolveOrderByClientOrderId } from './order-lookup.service';
import { insertRiderLocation } from './order-rider-location.repository';

export async function ingestShadowfaxStatusWebhook(
  payload: ShadowfaxWebhookPayload,
): Promise<{ duplicate: boolean; eventId: string }> {
  incrementShadowfaxMetric('shadowfax_webhooks_received_total');

  const eventKey = buildShadowfaxEventKey(payload);
  const result = await insertWebhookEventIfNotExists({
    eventKey,
    sfxOrderId: extractSfxOrderId(payload),
    clientOrderId: extractClientOrderId(payload),
    status: extractShadowfaxStatus(payload),
    payload,
  });

  if (!result.inserted) {
    incrementShadowfaxMetric('shadowfax_webhooks_duplicate_total');
    logger.info({ eventKey }, 'shadowfax_webhook_duplicate');
    return { duplicate: true, eventId: result.event.id };
  }

  await enqueueShadowfaxJob({ type: 'process_shadowfax_webhook', eventId: result.event.id });
  logger.info({ eventId: result.event.id, eventKey }, 'shadowfax_webhook_received');

  return { duplicate: false, eventId: result.event.id };
}

export async function ingestShadowfaxRiderLocation(
  payload: ShadowfaxRiderLocationPayload,
): Promise<void> {
  incrementShadowfaxMetric('shadowfax_webhooks_received_total');

  const clientOrderId = String(payload.client_order_id);
  const order = await resolveOrderByClientOrderId(
    clientOrderId,
    payload.sfx_order_id != null ? Number(payload.sfx_order_id) : null,
  );

  if (!order) {
    logger.warn({ clientOrderId }, 'rider_location_order_not_found');
    return;
  }

  const recordedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();

  await insertRiderLocation({
    orderId: order.id,
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    pickupEta: payload.pickup_eta ?? null,
    dropEta: payload.drop_eta ?? null,
    recordedAt: Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt,
  });

  logger.info({ orderId: order.id }, 'rider_location_stored');
}
