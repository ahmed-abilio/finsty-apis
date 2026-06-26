import type { OrderStatus } from '@modules/order/order.model';
import Order from '@modules/order/order.model';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import logger from '@utils/logger';
import { isShadowfaxDevLocalCallbackEnabled } from '@modules/platform-settings/platform-settings.service';
import {
  isShadowfaxCancelledStatus,
  isShadowfaxReturnedStatus,
  mapShadowfaxStatusToInternal,
} from './shadowfax-status.mapper';
import { transitionOrderStatus } from './order-status-transition.service';
import { buildOrderPatch } from './shadowfax-webhook.processor';
import { extractShadowfaxCancelFields, mapShadowfaxCancelStatusToLabel } from './shadowfax-cancel-fields';
import type { ShadowfaxWebhookPayload } from './shadowfax-webhook.types';
import { extractShadowfaxStatus } from './shadowfax-event-key';

export function shadowfaxStatusDataToWebhookPayload(
  data: ShadowfaxOrderStatusData,
): ShadowfaxWebhookPayload {
  const details = data.order_details;
  const status = (data.status ?? '').toUpperCase();
  const cancelTime =
    data.cancel_time ??
    details.cancel_time ??
    (isShadowfaxCancelledStatus(status) ? details.last_update_time : null);
  const rtsTime =
    data.rts_time ??
    details.rts_time ??
    (isShadowfaxReturnedStatus(status) ? details.last_update_time : null);
  const { cancelReasonCode, cancelReasonText } = extractShadowfaxCancelFields({
    ...data,
    status: data.status,
    order_status: data.status,
  });
  const cancelLabel = mapShadowfaxCancelStatusToLabel(status);

  return {
    client_order_id: details.client_order_id,
    order_status: data.status,
    status: data.status,
    sfx_order_id: data.sfx_order_id,
    delivery_time: details.delivery_time ?? undefined,
    cancel_time: cancelTime ?? undefined,
    rts_time: rtsTime ?? undefined,
    cancel_reason: cancelLabel ?? cancelReasonCode ?? undefined,
    cancel_reason_text: cancelReasonText ?? undefined,
    reason: cancelReasonCode ?? undefined,
    reason_text: cancelReasonText ?? undefined,
    rider_name: data.rider_details?.rider_name,
    rider_phone: data.rider_details?.rider_phone,
    rider_details: data.rider_details,
    drop_image_url: data.drop_image_url ?? undefined,
    order_details: {
      client_order_id: details.client_order_id,
      delivery_time: details.delivery_time ?? undefined,
    },
  };
}

export interface ShadowfaxStatusSyncResult {
  attempted: boolean;
  applied: boolean;
  reason?: string;
}

/** @deprecated Use ShadowfaxStatusSyncResult */
export type DevLocalCallbackSyncResult = ShadowfaxStatusSyncResult;

/**
 * Apply Shadowfax status to the local order row (webhook-style FSM transitions).
 * Used when polling Shadowfax (delivery-status, reconciliation) when webhooks were missed.
 */
export async function syncOrderFromShadowfaxStatus(
  orderId: string,
  statusData: ShadowfaxOrderStatusData,
  source: 'shadowfax_delivery_status' | 'shadowfax_reconciliation' | 'shadowfax_dev_local_callback' | 'shadowfax_order_detail',
): Promise<ShadowfaxStatusSyncResult> {
  const payload = shadowfaxStatusDataToWebhookPayload(statusData);
  const shadowfaxStatus = extractShadowfaxStatus(payload);
  const internalStatus = mapShadowfaxStatusToInternal(shadowfaxStatus);

  if (!internalStatus) {
    logger.info({ orderId, shadowfaxStatus, source }, 'shadowfax_status_sync_unmapped');
    return { attempted: true, applied: false, reason: 'unmapped_status' };
  }

  const order = await Order.findByPk(orderId, {
    attributes: ['id', 'status', 'deliveryMetadata'],
  });
  if (!order) {
    return { attempted: true, applied: false, reason: 'order_not_found' };
  }

  const orderPatch = buildOrderPatch(shadowfaxStatus, payload, order.deliveryMetadata);

  const result = await transitionOrderStatus({
    orderId,
    toStatus: internalStatus as OrderStatus,
    source,
    payload,
    orderPatch,
  });

  if (result.applied) {
    logger.info(
      { orderId, from: result.oldStatus, to: result.newStatus, shadowfaxStatus, source },
      'shadowfax_status_synced',
    );
  } else if (result.reason === 'invalid_transition') {
    logger.warn(
      { orderId, from: result.oldStatus, to: internalStatus, shadowfaxStatus, source },
      'shadowfax_status_sync_invalid_transition',
    );
  }

  return {
    attempted: true,
    applied: result.applied,
    reason: result.applied ? undefined : result.reason,
  };
}

/**
 * When `shadowfax_dev_local_callback_enabled` is true (development only), apply Shadowfax
 * status to the local order row — simulates webhook delivery without a public tunnel.
 */
export async function syncOrderFromShadowfaxStatusIfDevCallbackEnabled(
  orderId: string,
  statusData: ShadowfaxOrderStatusData,
): Promise<ShadowfaxStatusSyncResult> {
  const enabled = await isShadowfaxDevLocalCallbackEnabled();
  if (!enabled) {
    return { attempted: false, applied: false, reason: 'dev_local_callback_disabled' };
  }

  return syncOrderFromShadowfaxStatus(orderId, statusData, 'shadowfax_dev_local_callback');
}
