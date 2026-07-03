import OrderReturn, { type OrderReturnStatus } from '@modules/order/order-return.model';
import ShadowfaxReturnShipment from '@modules/shadowfax/shadowfax-return-shipment.model';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import logger from '@utils/logger';
import {
  mapLogisticsToReturnStatus,
  mapShadowfaxStatusToReturnLogistics,
} from '@modules/order/orderReturn.utils';
import { buildOrderPatch } from './shadowfax-webhook.processor';
import type { ShadowfaxWebhookPayload } from './shadowfax-webhook.types';
import { extractShadowfaxStatus } from './shadowfax-event-key';
import { shadowfaxStatusDataToWebhookPayload } from './shadowfax-dev-local-callback.service';
import { notifyVendorReturnReceived } from '@modules/notification/notification.return';

type ReturnPatch = {
  shadowfaxOrderId?: string | null;
  shadowfaxTrackingUrl?: string | null;
  deliveryMetadata?: object | null;
  riderId?: number | null;
  riderName?: string | null;
  riderPhone?: string | null;
  receivedAtStoreAt?: Date | null;
  status?: OrderReturnStatus;
  logisticsStatus?: import('@modules/order/order-return.model').OrderReturnLogisticsStatus;
};

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

export function buildReturnPatch(
  shadowfaxStatus: string,
  payload: ShadowfaxWebhookPayload,
  existingMetadata: object | null,
): ReturnPatch {
  const patch: ReturnPatch = {};
  const logistics = mapShadowfaxStatusToReturnLogistics(shadowfaxStatus);
  if (logistics) {
    patch.logisticsStatus = logistics;
    patch.status = mapLogisticsToReturnStatus(logistics);
  }

  const orderPatch = buildOrderPatch(shadowfaxStatus, payload, existingMetadata);
  if (orderPatch.shadowfaxOrderId != null) {
    patch.shadowfaxOrderId = String(orderPatch.shadowfaxOrderId);
  }
  if (orderPatch.shadowfaxTrackingUrl) patch.shadowfaxTrackingUrl = orderPatch.shadowfaxTrackingUrl;
  if (orderPatch.riderId != null) patch.riderId = orderPatch.riderId;
  if (orderPatch.riderName) patch.riderName = orderPatch.riderName;
  if (orderPatch.riderPhone) patch.riderPhone = orderPatch.riderPhone;
  if (orderPatch.deliveryMetadata) patch.deliveryMetadata = orderPatch.deliveryMetadata;

  if (shadowfaxStatus === 'DELIVERED') {
    patch.receivedAtStoreAt = orderPatch.deliveredAt ?? new Date();
    patch.status = 'pending_inspection';
    patch.logisticsStatus = 'delivered';
  }

  if (orderPatch.deliveryMetadata && !patch.deliveryMetadata) {
    patch.deliveryMetadata = mergeDeliveryMetadata(existingMetadata, orderPatch.deliveryMetadata as Record<string, unknown>);
  }

  return patch;
}

const TERMINAL_RETURN_STATUSES: OrderReturnStatus[] = [
  'refund_approved',
  'refund_rejected',
  'cancelled',
];

export async function processReturnShadowfaxWebhook(
  orderReturn: OrderReturn,
  payload: ShadowfaxWebhookPayload,
): Promise<{ applied: boolean; reason?: string }> {
  if (TERMINAL_RETURN_STATUSES.includes(orderReturn.status)) {
    return { applied: false, reason: 'terminal_status' };
  }

  const shadowfaxStatus = extractShadowfaxStatus(payload);
  const logistics = mapShadowfaxStatusToReturnLogistics(shadowfaxStatus);
  if (!logistics) {
    return { applied: false, reason: `unmapped_status:${shadowfaxStatus}` };
  }

  const patch = buildReturnPatch(shadowfaxStatus, payload, orderReturn.deliveryMetadata);
  const wasPendingInspection = orderReturn.status === 'pending_inspection';

  await orderReturn.update(patch);

  if (patch.status === 'pending_inspection' && !wasPendingInspection) {
    void notifyVendorReturnReceived(orderReturn.storeId, orderReturn.orderId, orderReturn.id).catch(
      (err) => {
        logger.error({ err, returnId: orderReturn.id }, 'Failed to notify vendor return received');
      },
    );
  }

  return { applied: true };
}

export async function syncReturnFromShadowfaxStatus(
  orderReturnId: string,
  statusData: ShadowfaxOrderStatusData,
  _source: 'shadowfax_delivery_status' | 'shadowfax_order_detail',
): Promise<{ applied: boolean; reason?: string }> {
  const orderReturn = await OrderReturn.findByPk(orderReturnId);
  if (!orderReturn) return { applied: false, reason: 'return_not_found' };

  const payload = shadowfaxStatusDataToWebhookPayload(statusData);
  return processReturnShadowfaxWebhook(orderReturn, payload);
}

export async function fetchAndSyncShadowfaxReturnDeliveryStatus(
  orderReturnId: string,
): Promise<ShadowfaxOrderStatusData | null> {
  const shipment = await ShadowfaxReturnShipment.findOne({ where: { orderReturnId } });
  if (!shipment || shipment.status !== 'placed' || !shipment.shadowfaxOrderId) {
    return null;
  }

  const status = await shadowfaxStatusService.fetchOrderStatus(shipment.shadowfaxOrderId);
  if (!status.track_url && shipment.trackUrl) {
    status.track_url = shipment.trackUrl;
  }

  await syncReturnFromShadowfaxStatus(orderReturnId, status, 'shadowfax_delivery_status');
  return status;
}
