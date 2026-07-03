import type { DeliveryType } from './order.model';
import type { OrderReturnStatus } from './order-return.model';
import { fetchAndSyncShadowfaxReturnDeliveryStatus } from '@modules/shadowfax/tracking/order-return-shadowfax.processor';
import logger from '@utils/logger';

const SKIP_RETURN_SHADOWFAX_SYNC_STATUSES: OrderReturnStatus[] = [
  'refund_approved',
  'refund_rejected',
  'cancelled',
];

export async function syncReturnShadowfaxStatusFromRemote(
  orderReturnId: string,
  deliveryType: DeliveryType,
  returnStatus: OrderReturnStatus,
): Promise<void> {
  if (deliveryType !== 'delivery') return;
  if (SKIP_RETURN_SHADOWFAX_SYNC_STATUSES.includes(returnStatus)) return;

  await fetchAndSyncShadowfaxReturnDeliveryStatus(orderReturnId);
}

/** Best-effort Shadowfax sync when loading return detail — never fails the request. */
export async function maybeSyncOrderReturnShadowfaxStatusForReturnDetail(
  orderReturnId: string,
  deliveryType: DeliveryType,
  returnStatus: OrderReturnStatus,
): Promise<void> {
  try {
    await syncReturnShadowfaxStatusFromRemote(orderReturnId, deliveryType, returnStatus);
  } catch (err) {
    logger.warn({ err, orderReturnId }, 'shadowfax_return_order_detail_sync_failed');
  }
}
