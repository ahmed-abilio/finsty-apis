import logger from '@utils/logger';
import { NotificationType } from '@modules/notification/notification.types';
import { notifyBuyerOrderStatus, scheduleRateOrderReminder } from '@modules/notification/notification.order';
import type { OrderStatusChangedEvent } from './shadowfax-webhook.types';

export interface OrderRealtimePublisher {
  emitOrderStatus(orderId: string, payload: { status: string }): void;
}

export class NoopOrderRealtimePublisher implements OrderRealtimePublisher {
  emitOrderStatus(orderId: string, payload: { status: string }): void {
    logger.debug({ orderId, status: payload.status }, 'order_realtime_noop_emit');
  }
}

let realtimePublisher: OrderRealtimePublisher = new NoopOrderRealtimePublisher();

export function setOrderRealtimePublisher(publisher: OrderRealtimePublisher): void {
  realtimePublisher = publisher;
}

export function getOrderRealtimePublisher(): OrderRealtimePublisher {
  return realtimePublisher;
}

export async function publishOrderStatusChanged(
  event: OrderStatusChangedEvent & { userId: string },
): Promise<void> {
  logger.info(
    {
      event: 'ORDER_STATUS_CHANGED',
      orderId: event.orderId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    },
    'order_status_changed',
  );

  notifyBuyerOrderStatus(event.userId, event.orderId, event.newStatus);

  if (event.newStatus === 'delivered') {
    scheduleRateOrderReminder(event.userId, event.orderId);
  }

  realtimePublisher.emitOrderStatus(event.orderId, { status: event.newStatus });
}

export { NotificationType };
