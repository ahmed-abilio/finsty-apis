import { describe, expect, it } from 'vitest';
import { buildNotificationPayload } from './notification.messages';
import { NotificationType } from './notification.types';

describe('buildNotificationPayload', () => {
  it('includes type and Flutter click_action in data', () => {
    const payload = buildNotificationPayload(NotificationType.LOGIN_SUCCESS, {});
    expect(payload.data.type).toBe(NotificationType.LOGIN_SUCCESS);
    expect(payload.data.click_action).toBe('FLUTTER_NOTIFICATION_CLICK');
  });

  it('stringifies context fields in data', () => {
    const payload = buildNotificationPayload(NotificationType.ORDER_PLACED, {
      orderId: 'abc-123',
      orderNumber: 'ABC12345',
    });
    expect(payload.data.orderId).toBe('abc-123');
    expect(payload.data.orderNumber).toBe('ABC12345');
    expect(payload.title).toBe('Order placed');
    expect(payload.body).toContain('ABC12345');
  });

  it('builds payment cancelled copy', () => {
    const payload = buildNotificationPayload(NotificationType.PAYMENT_CANCELLED, {
      orderNumber: 'ORD9',
    });
    expect(payload.title).toBe('Payment cancelled');
    expect(payload.body).toContain('not completed');
    expect(payload.body).toContain('ORD9');
  });

  it('formats payment success with INR amount', () => {
    const payload = buildNotificationPayload(NotificationType.PAYMENT_SUCCESS, {
      orderNumber: 'ORD1',
      amount: 99.5,
    });
    expect(payload.body).toContain('99.50');
    expect(payload.body).toContain('ORD1');
  });

  it('maps order status to human-readable label', () => {
    const payload = buildNotificationPayload(NotificationType.ORDER_STATUS, {
      orderNumber: 'X1',
      status: 'shipped',
    });
    expect(payload.body).toContain('Shipped');
  });

  it('builds coupon applied copy', () => {
    const payload = buildNotificationPayload(NotificationType.COUPON_APPLIED, {
      code: 'SAVE10',
      discount: 50,
    });
    expect(payload.body).toContain('SAVE10');
    expect(payload.body).toContain('50.00');
  });
});
