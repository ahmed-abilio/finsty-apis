import { FastifyInstance } from 'fastify';
import notificationInboxController from './notification.inbox.controller';
import {
  listNotificationsSchema,
  unreadCountNotificationsSchema,
  markNotificationReadSchema,
  markAllNotificationsReadSchema,
  deleteNotificationSchema,
} from './notification.inbox.schema';
import type { ListNotificationsQuery } from './notification.inbox.service';
import type { NotificationCategory } from './notification-inbox.model';

export default async function notificationInboxRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get<{ Querystring: ListNotificationsQuery }>(
    '/',
    { schema: listNotificationsSchema },
    notificationInboxController.list.bind(notificationInboxController),
  );

  fastify.get(
    '/unread-count',
    { schema: unreadCountNotificationsSchema },
    notificationInboxController.unreadCount.bind(notificationInboxController),
  );

  fastify.patch(
    '/read-all',
    { schema: markAllNotificationsReadSchema },
    notificationInboxController.markAllRead.bind(notificationInboxController),
  );

  fastify.patch<{ Params: { notificationId: string } }>(
    '/:notificationId/read',
    { schema: markNotificationReadSchema },
    notificationInboxController.markRead.bind(notificationInboxController),
  );

  fastify.delete<{ Body: { ids: string[] } }>(
    '/',
    { schema: deleteNotificationSchema },
    notificationInboxController.delete.bind(notificationInboxController),
  );
}

export type { ListNotificationsQuery, NotificationCategory };
