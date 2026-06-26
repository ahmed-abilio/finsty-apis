import { Op } from 'sequelize';
import Order, { type OrderStatus } from '@modules/order/order.model';
import logger from '@utils/logger';
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
): Promise<{ checked: number; fixed: number }> {
  const orders = await Order.findAll({
    where: {
      status: { [Op.in]: ACTIVE_STATUSES },
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
