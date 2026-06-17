import { Op } from 'sequelize';
import Order, { type OrderStatus } from '@modules/order/order.model';
import logger from '@utils/logger';
import { incrementShadowfaxMetric } from '@observability/shadowfax.metrics';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import { isShadowfaxDevLocalCallbackEnabled } from '@modules/platform-settings/platform-settings.service';
import { mapShadowfaxStatusToInternal } from './shadowfax-status.mapper';
import { transitionOrderStatus } from './order-status-transition.service';
import { deleteRiderLocationsOlderThan } from './order-rider-location.repository';
import { syncOrderFromShadowfaxStatusIfDevCallbackEnabled } from './shadowfax-dev-local-callback.service';

const DEFAULT_ACTIVE_STATUSES: OrderStatus[] = [
  'rider_assigned',
  'at_store',
  'picked_up',
  'out_for_delivery',
];

const DEV_LOCAL_CALLBACK_ACTIVE_STATUSES: OrderStatus[] = [
  'confirmed',
  ...DEFAULT_ACTIVE_STATUSES,
];

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Shadowfax reconciliation aborted');
  }
}

export async function runShadowfaxReconciliation(
  signal?: AbortSignal,
): Promise<{ checked: number; fixed: number }> {
  const devLocalCallback = await isShadowfaxDevLocalCallbackEnabled();
  const activeStatuses = devLocalCallback
    ? DEV_LOCAL_CALLBACK_ACTIVE_STATUSES
    : DEFAULT_ACTIVE_STATUSES;

  const orders = await Order.findAll({
    where: {
      status: { [Op.in]: activeStatuses },
      deliveryPartner: 'SHADOWFAX',
    },
    attributes: ['id', 'status', 'shadowfaxOrderId', 'userId'],
  });

  let fixed = 0;

  for (const order of orders) {
    throwIfAborted(signal);

    const sfxId = order.shadowfaxOrderId;
    if (sfxId == null) continue;

    try {
      const remote = await shadowfaxStatusService.fetchOrderStatus(String(sfxId));

      if (devLocalCallback) {
        const sync = await syncOrderFromShadowfaxStatusIfDevCallbackEnabled(order.id, remote);
        if (sync.applied) {
          fixed += 1;
          incrementShadowfaxMetric('shadowfax_reconciliation_fixes_total');
        }
        continue;
      }

      const mapped = mapShadowfaxStatusToInternal(remote.status);
      if (!mapped || mapped === order.status) continue;

      const result = await transitionOrderStatus({
        orderId: order.id,
        toStatus: mapped,
        source: 'shadowfax_reconciliation',
        payload: remote as object,
        remarks: `reconciliation:${order.status}->${mapped}`,
        allowManual: false,
      });

      if (result.applied) {
        fixed += 1;
        incrementShadowfaxMetric('shadowfax_reconciliation_fixes_total');
        logger.info(
          { orderId: order.id, from: order.status, to: mapped },
          'shadowfax_reconciliation_fix',
        );
      }
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'shadowfax_reconciliation_order_failed');
    }
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const deleted = await deleteRiderLocationsOlderThan(cutoff);
  if (deleted > 0) {
    logger.info({ deleted }, 'rider_location_retention_cleanup');
  }

  return { checked: orders.length, fixed };
}
