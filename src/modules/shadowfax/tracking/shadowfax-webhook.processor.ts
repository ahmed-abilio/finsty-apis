import type { OrderStatus } from '@modules/order/order.model';
import logger from '@utils/logger';
import { incrementShadowfaxMetric } from '@observability/shadowfax.metrics';
import { mapShadowfaxStatusToInternal } from './shadowfax-status.mapper';
import { transitionOrderStatus } from './order-status-transition.service';
import { resolveOrderByClientOrderId } from './order-lookup.service';
import { markWebhookEventProcessed } from './shadowfax-webhook-event.repository';
import type { ShadowfaxWebhookPayload } from './shadowfax-webhook.types';
import {
  extractClientOrderId,
  extractShadowfaxStatus,
  extractSfxOrderId,
} from './shadowfax-event-key';

type OrderPatch = {
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
  returnedAt?: Date | null;
  riderId?: number | null;
  riderName?: string | null;
  riderPhone?: string | null;
  shadowfaxOrderId?: number | null;
  shadowfaxTrackingUrl?: string | null;
  deliveryMetadata?: object | null;
};

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function mergeDeliveryMetadata(
  existing: object | null,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

export function buildOrderPatch(
  shadowfaxStatus: string,
  payload: ShadowfaxWebhookPayload,
  existingMetadata: object | null,
): OrderPatch {
  const patch: OrderPatch = {};
  const sfxId = extractSfxOrderId(payload);

  if (sfxId != null) patch.shadowfaxOrderId = sfxId;

  const riderName =
    payload.rider_name ?? payload.rider_details?.rider_name ?? undefined;
  const riderPhone =
    payload.rider_phone ?? payload.rider_details?.rider_phone ?? undefined;
  const riderIdRaw = payload.rider_id ?? payload.rider_details?.rider_id;
  const riderId = riderIdRaw != null ? Number(riderIdRaw) : null;

  if (shadowfaxStatus === 'ALLOTTED') {
    if (riderName) patch.riderName = String(riderName);
    if (riderPhone) patch.riderPhone = String(riderPhone);
    if (riderId != null && Number.isFinite(riderId)) patch.riderId = riderId;
  }

  if (shadowfaxStatus === 'DELIVERED') {
    patch.deliveredAt = parseDate(payload.delivery_time ?? payload.order_details?.delivery_time);
    if (payload.drop_image_url) {
      patch.deliveryMetadata = mergeDeliveryMetadata(existingMetadata, {
        drop_image_url: payload.drop_image_url,
      });
    }
  }

  if (shadowfaxStatus === 'CANCELLED' || shadowfaxStatus === 'CANCELLED_BY_CUSTOMER') {
    patch.cancelledAt = parseDate(payload.cancel_time);
    patch.deliveryMetadata = mergeDeliveryMetadata(existingMetadata, {
      cancel_reason: payload.cancel_reason ?? payload.reason ?? null,
      cancel_reason_text: payload.cancel_reason_text ?? payload.reason_text ?? null,
    });
  }

  if (shadowfaxStatus === 'RETURNED_TO_SELLER') {
    patch.returnedAt = parseDate(payload.rts_time);
  }

  return patch;
}

export async function processShadowfaxWebhookEvent(eventId: string): Promise<void> {
  const { findWebhookEventById } = await import('./shadowfax-webhook-event.repository');
  const event = await findWebhookEventById(eventId);
  if (!event) {
    logger.warn({ eventId }, 'shadowfax_webhook_event_not_found');
    return;
  }
  if (event.processed) return;

  const payload = event.payload as ShadowfaxWebhookPayload;
  const shadowfaxStatus = extractShadowfaxStatus(payload);
  const clientOrderId = extractClientOrderId(payload);

  try {
    if (!clientOrderId) {
      await markWebhookEventProcessed(eventId, 'missing_client_order_id');
      incrementShadowfaxMetric('shadowfax_webhooks_processed_total');
      return;
    }

    const internalStatus = mapShadowfaxStatusToInternal(shadowfaxStatus);
    if (!internalStatus) {
      await markWebhookEventProcessed(eventId, `unmapped_status:${shadowfaxStatus}`);
      incrementShadowfaxMetric('shadowfax_webhooks_processed_total');
      logger.info({ shadowfaxStatus, eventId }, 'shadowfax_webhook_unmapped_status');
      return;
    }

    const order = await resolveOrderByClientOrderId(clientOrderId, extractSfxOrderId(payload));
    if (!order) {
      await markWebhookEventProcessed(eventId, 'order_not_found');
      incrementShadowfaxMetric('shadowfax_webhooks_processed_total');
      logger.warn({ clientOrderId, eventId }, 'shadowfax_webhook_order_not_found');
      return;
    }

    const orderPatch = buildOrderPatch(shadowfaxStatus, payload, order.deliveryMetadata);

    const result = await transitionOrderStatus({
      orderId: order.id,
      toStatus: internalStatus as OrderStatus,
      source: 'shadowfax_webhook',
      payload,
      orderPatch,
      allowManual: false,
    });

    const remarks = result.applied
      ? null
      : result.reason === 'invalid_transition'
        ? `invalid_transition:${result.oldStatus}->${internalStatus}`
        : result.reason ?? null;

    await markWebhookEventProcessed(eventId, remarks);
    incrementShadowfaxMetric('shadowfax_webhooks_processed_total');

    if (remarks?.startsWith('invalid_transition')) {
      logger.warn({ orderId: order.id, remarks, shadowfaxStatus }, 'invalid_transition');
    } else {
      logger.info({ orderId: order.id, shadowfaxStatus, internalStatus }, 'shadowfax_webhook_processed');
    }
  } catch (err) {
    incrementShadowfaxMetric('shadowfax_webhooks_failed_total');
    logger.error({ err, eventId, payload }, 'shadowfax_webhook_process_failed');
    throw err;
  }
}
