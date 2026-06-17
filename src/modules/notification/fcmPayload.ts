import type { MulticastMessage } from 'firebase-admin/messaging';
import type { NotificationPayload } from './notification.types';

export function buildMulticastMessage(
  tokens: string[],
  payload: NotificationPayload,
): MulticastMessage {
  return {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'finsty_default',
        sound: 'default',
      },
    },
  };
}
