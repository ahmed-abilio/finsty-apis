import type { OrderStatus } from '@modules/order/order.model';
import Order from '@modules/order/order.model';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import logger from '@utils/logger';
import { isShadowfaxDevLocalCallbackEnabled } from '@modules/platform-settings/platform-settings.service';
import { mapShadowfaxStatusToInternal } from './shadowfax-status.mapper';
import { transitionOrderStatus } from './order-status-transition.service';
import { buildOrderPatch } from './shadowfax-webhook.processor';
import type { ShadowfaxWebhookPayload } from './shadowfax-webhook.types';
import { extractShadowfaxStatus } from './shadowfax-event-key';

export function shadowfaxStatusDataToWebhookPayload(
  data: ShadowfaxOrderStatusData,
): ShadowfaxWebhookPayload {
  return {
    client_order_id: data.order_details.client_order_id,
    order_status: data.status,
    status: data.status,
    sfx_order_id: data.sfx_order_id,
    delivery_time: data.order_details.delivery_time ?? undefined,
    rider_name: data.rider_details?.rider_name,
    rider_phone: data.rider_details?.rider_phone,
    drop_image_url: data.drop_image_url ?? undefined,
    order_details: {
      client_order_id: data.order_details.client_order_id,
      delivery_time: data.order_details.delivery_time ?? undefined,
    },
  };
}

export interface DevLocalCallbackSyncResult {
  attempted: boolean;
  applied: boolean;
  reason?: string;
}

/**
 * When `shadowfax_dev_local_callback_enabled` is true (development only), apply Shadowfax
 * status to the local order row — simulates webhook delivery without a public tunnel.
 */
export async function syncOrderFromShadowfaxStatusIfDevCallbackEnabled(
  orderId: string,
  statusData: ShadowfaxOrderStatusData,
): Promise<DevLocalCallbackSyncResult> {
  const enabled = await isShadowfaxDevLocalCallbackEnabled();
  if (!enabled) {
    return { attempted: false, applied: false, reason: 'dev_local_callback_disabled' };
  }

  const payload = shadowfaxStatusDataToWebhookPayload(statusData);
  const shadowfaxStatus = extractShadowfaxStatus(payload);
  const internalStatus = mapShadowfaxStatusToInternal(shadowfaxStatus);

  if (!internalStatus) {
    logger.info({ orderId, shadowfaxStatus }, 'dev_local_callback_unmapped_status');
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
    source: 'shadowfax_dev_local_callback',
    payload,
    orderPatch,
    allowManual: true,
  });

  if (result.applied) {
    logger.info(
      { orderId, from: result.oldStatus, to: result.newStatus, shadowfaxStatus },
      'dev_local_callback_synced',
    );
  } else if (result.reason === 'invalid_transition') {
    logger.warn(
      { orderId, from: result.oldStatus, to: internalStatus, shadowfaxStatus },
      'dev_local_callback_invalid_transition',
    );
  }

  return {
    attempted: true,
    applied: result.applied,
    reason: result.applied ? undefined : result.reason,
  };
}
