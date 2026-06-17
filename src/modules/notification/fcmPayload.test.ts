import { describe, expect, it } from 'vitest';
import { buildMulticastMessage } from './fcmPayload';
import { NotificationType } from './notification.types';
import { buildNotificationPayload } from './notification.messages';

describe('buildMulticastMessage', () => {
  it('builds cross-platform multicast with finsty_default channel', () => {
    const payload = buildNotificationPayload(NotificationType.LOGIN_SUCCESS, {});
    const message = buildMulticastMessage(['token-a', 'token-b'], payload);

    expect(message.tokens).toEqual(['token-a', 'token-b']);
    expect(message.notification?.title).toBe(payload.title);
    expect(message.data?.type).toBe(NotificationType.LOGIN_SUCCESS);
    expect(message.android?.priority).toBe('high');
    expect(message.android?.notification?.channelId).toBe('finsty_default');
    expect(message.apns?.payload?.aps?.sound).toBe('default');
  });
});
