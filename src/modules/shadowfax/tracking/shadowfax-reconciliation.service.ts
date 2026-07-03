import { Op } from 'sequelize';
import Order, { type OrderStatus } from '@modules/order/order.model';
import logger from '@utils/logger';
import { AppError } from '@utils/appError';
import { incrementShadowfaxMetric } from '@observability/shadowfax.metrics';
import shadowfaxStatusService from '@modules/shadowfax/shadowfaxStatus.service';
import { deleteRiderLocationsOlderThan } from './order-rider-location.repository';
import { syncOrderFromShadowfaxStatus } from './shadowfax-dev-local-callback.service';

const ACTIVE_STATUSES: OrderStatus[] = [
  'confirmed',
  'rider_assigned',
  'at_store',
  'picked_up',
  'arrived',
  'delivered',
];

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Shadowfax reconciliation aborted');
  }
}

export async function runShadowfaxReconciliation(
  signal?: AbortSignal,
): Promise<{ checked: number; fixed: number; abortedUnreachable: boolean }> {
  const orders = await Order.findAll({
    where: {
      status: { [Op.in]: ACTIVE_STATUSES },
      deliveryPartner: 'SHADOWFAX',
    },
    attributes: ['id', 'status', 'shadowfaxOrderId', 'userId'],
  });

  let fixed = 0;
  let checked = 0;
  let abortedUnreachable = false;

  for (const order of orders) {
    throwIfAborted(signal);

    const sfxId = order.shadowfaxOrderId;
    if (sfxId == null) continue;

    checked += 1;

    try {
      const remote = await shadowfaxStatusService.fetchOrderStatus(String(sfxId));
      const sync = await syncOrderFromShadowfaxStatus(
        order.id,
        remote,
        'shadowfax_reconciliation',
      );

      if (sync.applied) {
        fixed += 1;
        incrementShadowfaxMetric('shadowfax_reconciliation_fixes_total');
        logger.info({ orderId: order.id, from: order.status }, 'shadowfax_reconciliation_fix');
      }
    } catch (err) {
      // A connectivity/timeout failure means Shadowfax itself is unreachable, so every
      // remaining order in this run would fail identically. Abort early and log once at
      // WARN instead of emitting a full error stack per active order.
      if (err instanceof AppError && err.code === 'SHADOWFAX_UNAVAILABLE') {
        abortedUnreachable = true;
        logger.warn(
          { reason: err.message, checked, remaining: orders.length - checked },
          'shadowfax_reconciliation_unreachable_aborted',
        );
        break;
      }
      logger.error({ err, orderId: order.id }, 'shadowfax_reconciliation_order_failed');
    }
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const deleted = await deleteRiderLocationsOlderThan(cutoff);
  if (deleted > 0) {
    logger.info({ deleted }, 'rider_location_retention_cleanup');
  }

  return { checked, fixed, abortedUnreachable };
}
