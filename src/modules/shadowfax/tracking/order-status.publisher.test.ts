import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@modules/notification/notification.order', () => ({
  notifyBuyerOrderStatus: vi.fn(),
}));

import { notifyBuyerOrderStatus } from '@modules/notification/notification.order';
import {
  NoopOrderRealtimePublisher,
  publishOrderStatusChanged,
  setOrderRealtimePublisher,
} from './order-status.publisher';

const notify = vi.mocked(notifyBuyerOrderStatus);

describe('order-status.publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOrderRealtimePublisher(new NoopOrderRealtimePublisher());
  });

  it('publishes ORDER_STATUS_CHANGED via notification and noop socket', async () => {
    const emitSpy = vi.spyOn(NoopOrderRealtimePublisher.prototype, 'emitOrderStatus');

    await publishOrderStatusChanged({
      orderId: 'order-1',
      userId: 'user-1',
      oldStatus: 'confirmed',
      newStatus: 'rider_assigned',
      timestamp: new Date().toISOString(),
    });

    expect(notify).toHaveBeenCalledWith('user-1', 'order-1', 'rider_assigned');
    expect(emitSpy).toHaveBeenCalledWith('order-1', { status: 'rider_assigned' });
  });
});
