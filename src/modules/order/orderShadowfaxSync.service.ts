import type { DeliveryType, OrderStatus } from './order.model';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import type { ShadowfaxOrderStatusData } from '@modules/shadowfax/shadowfaxOrderStatus.types';
import { syncOrderFromShadowfaxStatus } from '@modules/shadowfax/tracking/shadowfax-dev-local-callback.service';
import type { OrderStatusSource } from '@modules/shadowfax/tracking/shadowfax-webhook.types';
import logger from '@utils/logger';

const SKIP_SHADOWFAX_SYNC_STATUSES: OrderStatus[] = ['pending'];

type ShadowfaxPollSyncSource = Extract<
  OrderStatusSource,
  'shadowfax_delivery_status' | 'shadowfax_order_detail'
>;

async function fetchPlacedShadowfaxStatus(
  orderId: string,
): Promise<{ status: ShadowfaxOrderStatusData; shadowfaxOrderId: string } | null> {
  const shipment = await ShadowfaxShipment.findOne({ where: { orderId } });
  if (!shipment || shipment.status !== 'placed' || !shipment.shadowfaxOrderId) {
    return null;
  }

  const status = await shadowfaxStatusService.fetchOrderStatus(shipment.shadowfaxOrderId);
  if (!status.track_url && shipment.trackUrl) {
    status.track_url = shipment.trackUrl;
  }

  return { status, shadowfaxOrderId: shipment.shadowfaxOrderId };
}

async function applyShadowfaxPollSync(
  orderId: string,
  source: ShadowfaxPollSyncSource,
): Promise<ShadowfaxOrderStatusData | null> {
  const remote = await fetchPlacedShadowfaxStatus(orderId);
  if (!remote) return null;

  await syncOrderFromShadowfaxStatus(orderId, remote.status, source);
  return remote.status;
}

export async function syncOrderShadowfaxStatusFromRemote(
  orderId: string,
  deliveryType: DeliveryType,
  orderStatus: OrderStatus,
  source: ShadowfaxPollSyncSource,
): Promise<ShadowfaxOrderStatusData | null> {
  if (deliveryType !== 'delivery') return null;
  if (SKIP_SHADOWFAX_SYNC_STATUSES.includes(orderStatus)) return null;

  return applyShadowfaxPollSync(orderId, source);
}

/** Used by GET /orders/:orderId/delivery-status — always syncs when Shadowfax is placed. */
export async function fetchAndSyncShadowfaxDeliveryStatus(
  orderId: string,
): Promise<ShadowfaxOrderStatusData | null> {
  return applyShadowfaxPollSync(orderId, 'shadowfax_delivery_status');
}

/** Best-effort Shadowfax sync when loading order detail — never fails the request. */
export async function maybeSyncOrderShadowfaxStatusForOrderDetail(
  orderId: string,
  deliveryType: DeliveryType,
  orderStatus: OrderStatus,
): Promise<void> {
  try {
    await syncOrderShadowfaxStatusFromRemote(
      orderId,
      deliveryType,
      orderStatus,
      'shadowfax_order_detail',
    );
  } catch (err) {
    logger.warn({ err, orderId }, 'shadowfax_order_detail_sync_failed');
  }
}
