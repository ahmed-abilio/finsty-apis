import { AppError } from '@utils/appError';
import { Roles } from '@modules/user/user.model';
import NotificationInbox, { type NotificationCategory } from './notification-inbox.model';
import {
  isCategoryAllowedForRole,
  listCategoriesForRole,
  resolveNotificationCategory,
} from './notification.categories';
import type { NotificationPayload, NotificationRole, NotificationType } from './notification.types';

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  category?: NotificationCategory;
  isRead?: boolean;
}

class NotificationInboxService {
  async persist(
    userId: string,
    role: NotificationRole,
    type: NotificationType,
    payload: NotificationPayload,
  ): Promise<NotificationInbox> {
    return NotificationInbox.create({
      userId,
      role,
      type,
      category: resolveNotificationCategory(type, role),
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    });
  }

  async list(userId: string, role: NotificationRole, query: ListNotificationsQuery = {}) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { userId, role };

    if (query.category) {
      if (!isCategoryAllowedForRole(role, query.category)) {
        throw AppError.badRequest(
          `Invalid category for ${role}. Allowed: ${listCategoriesForRole(role).join(', ')}`,
          'INVALID_NOTIFICATION_CATEGORY',
        );
      }
      where.category = query.category;
    }

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const { count, rows } = await NotificationInbox.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      notifications: rows.map((row) => row.toPublicJSON()),
      total: count,
      page,
      limit,
      categories: listCategoriesForRole(role),
    };
  }

  async unreadCount(userId: string, role: NotificationRole) {
    const count = await NotificationInbox.count({
      where: { userId, role, isRead: false },
    });
    return { unreadCount: count, categories: listCategoriesForRole(role) };
  }

  async markRead(notificationId: string, userId: string, role: NotificationRole) {
    const row = await NotificationInbox.findOne({
      where: { id: notificationId, userId, role },
    });
    if (!row) {
      throw AppError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }
    if (!row.isRead) {
      await row.update({ isRead: true, readAt: new Date() });
    }
    return row.toPublicJSON();
  }

  async markAllRead(userId: string, role: NotificationRole, category?: NotificationCategory) {
    if (category && !isCategoryAllowedForRole(role, category)) {
      throw AppError.badRequest(
        `Invalid category for ${role}. Allowed: ${listCategoriesForRole(role).join(', ')}`,
        'INVALID_NOTIFICATION_CATEGORY',
      );
    }

    const where: Record<string, unknown> = { userId, role, isRead: false };
    if (category) where.category = category;

    const [updated] = await NotificationInbox.update(
      { isRead: true, readAt: new Date() },
      { where },
    );

    return { updated };
  }
}

export default new NotificationInboxService();

export function resolveRoleFromJwt(role: string | undefined): NotificationRole {
  if (role === Roles.VENDOR) return Roles.VENDOR;
  if (role === Roles.ADMIN) return Roles.ADMIN;
  return Roles.USER;
}
