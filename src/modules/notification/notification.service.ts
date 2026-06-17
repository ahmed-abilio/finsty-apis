import { Op } from 'sequelize';
import { firebaseMessaging } from '@config/firebase';
import { Roles } from '@modules/user/user.model';
import DeviceToken from './device-token.model';
import { buildNotificationPayload } from './notification.messages';
import { buildMulticastMessage } from './fcmPayload';
import {
  NotificationType,
  type NotificationContext,
  type NotificationRole,
} from './notification.types';
import { enqueuePushNotification } from '@queues/notificationQueue';
import notificationInboxService from './notification.inbox.service';
import logger from '@utils/logger';

const MAX_TOKENS_PER_USER = 10;
const FCM_BATCH_SIZE = 500;

function isInvalidTokenError(code: string | undefined): boolean {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

export async function registerDeviceToken(
  userId: string,
  role: NotificationRole,
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;

  // findOrCreate avoids Sequelize upsert emitting ON CONFLICT ("userId",…) while DB column is user_id
  const [record, created] = await DeviceToken.findOrCreate({
    where: { userId, role, token: trimmed },
    defaults: { userId, role, token: trimmed, platform },
  });

  if (!created) {
    await record.update({ platform });
  }

  // Cap tokens per user/role — keep most recently updated
  const tokens = await DeviceToken.findAll({
    where: { userId, role },
    attributes: ['id'],
    order: [['updatedAt', 'DESC']],
    limit: MAX_TOKENS_PER_USER + 5,
  });

  if (tokens.length > MAX_TOKENS_PER_USER) {
    const staleIds = tokens.slice(MAX_TOKENS_PER_USER).map((t) => t.id);
    await DeviceToken.destroy({ where: { id: { [Op.in]: staleIds } } });
  }
}

export async function sendPushToUser(
  userId: string,
  role: NotificationRole,
  type: NotificationType,
  context: NotificationContext = {},
): Promise<void> {
  const payload = buildNotificationPayload(type, context);

  try {
    await notificationInboxService.persist(userId, role, type, payload);
  } catch (err) {
    logger.error({ err, userId, role, type }, 'Failed to persist notification inbox row');
  }

  const rows = await DeviceToken.findAll({
    where: { userId, role },
    attributes: ['id', 'token'],
    order: [['updatedAt', 'DESC']],
    limit: MAX_TOKENS_PER_USER,
  });

  if (!rows.length) {
    logger.debug({ userId, role, type }, 'No device tokens — skip push');
    return;
  }

  const tokens = rows.map((r) => r.token);
  const tokenIdByValue = new Map(rows.map((r) => [r.token, r.id]));

  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
    const message = buildMulticastMessage(batch, payload);

    try {
      const result = await firebaseMessaging.sendEachForMulticast(message);
      const staleTokenIds: string[] = [];

      result.responses.forEach((res, idx) => {
        if (res.success) return;
        const code = res.error?.code;
        const token = batch[idx];
        if (token && isInvalidTokenError(code)) {
          const id = tokenIdByValue.get(token);
          if (id) staleTokenIds.push(id);
        } else {
          logger.warn({ userId, role, type, code, token: token?.slice(0, 12) }, 'FCM send failed');
        }
      });

      if (staleTokenIds.length) {
        await DeviceToken.destroy({ where: { id: { [Op.in]: staleTokenIds } } });
      }
    } catch (err) {
      logger.error({ err, userId, role, type }, 'FCM multicast failed');
    }
  }
}

export function notifyUser(
  userId: string,
  type: NotificationType,
  context: NotificationContext = {},
  options?: { delayMs?: number; jobId?: string },
): void {
  void enqueuePushNotification(
    { userId, role: Roles.USER, type, context },
    options,
  ).catch((err) => logger.error({ err, userId, type }, 'Failed to enqueue user notification'));
}

export function notifyVendor(
  vendorUserId: string,
  type: NotificationType,
  context: NotificationContext = {},
  options?: { delayMs?: number; jobId?: string },
): void {
  void enqueuePushNotification(
    { userId: vendorUserId, role: Roles.VENDOR, type, context },
    options,
  ).catch((err) =>
    logger.error({ err, vendorUserId, type }, 'Failed to enqueue vendor notification'),
  );
}

export function notifyAdmin(
  adminUserId: string,
  type: NotificationType,
  context: NotificationContext = {},
  options?: { delayMs?: number; jobId?: string },
): void {
  void enqueuePushNotification(
    { userId: adminUserId, role: Roles.ADMIN, type, context },
    options,
  ).catch((err) =>
    logger.error({ err, adminUserId, type }, 'Failed to enqueue admin notification'),
  );
}

export function walletCreditNotificationType(
  source: string | null | undefined,
): NotificationType {
  if (source === 'referral_reward') return NotificationType.REFERRAL_REWARD_CREDITED;
  if (source === 'bonus') return NotificationType.CASHBACK_RECEIVED;
  return NotificationType.WALLET_CREDITED;
}

export function formatOrderNumber(orderId: string): string {
  return orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
}
