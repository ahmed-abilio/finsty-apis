import type { MulticastMessage } from 'firebase-admin/messaging';
import { NotificationType, type NotificationPayload } from './notification.types';

const DEFAULT_SOUND = 'default';

const IOS_SOUND_BY_TYPE: Partial<Record<NotificationType, string>> = {
  [NotificationType.VENDOR_NEW_ORDER]: 'booking_recieved.caf',
};

export function buildMulticastMessage(
  tokens: string[],
  payload: NotificationPayload,
  type?: NotificationType,
): MulticastMessage {
  const iosSound = (type && IOS_SOUND_BY_TYPE[type]) ?? DEFAULT_SOUND;

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
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: iosSound,
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
