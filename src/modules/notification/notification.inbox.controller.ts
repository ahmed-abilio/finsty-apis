import { FastifyRequest, FastifyReply } from 'fastify';
import notificationInboxService, {
  type ListNotificationsQuery,
  resolveRoleFromJwt,
} from './notification.inbox.service';
import type { NotificationCategory } from './notification-inbox.model';

interface NotificationParams {
  notificationId: string;
}

interface MarkAllReadBody {
  category?: NotificationCategory;
}

class NotificationInboxController {
  async list(
    request: FastifyRequest<{ Querystring: ListNotificationsQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const role = resolveRoleFromJwt(request.user.role);
    const result = await notificationInboxService.list(request.user.sub, role, request.query);
    void reply.status(200).send({ success: true, data: result });
  }

  async unreadCount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const role = resolveRoleFromJwt(request.user.role);
    const result = await notificationInboxService.unreadCount(request.user.sub, role);
    void reply.status(200).send({ success: true, data: result });
  }

  async markRead(
    request: FastifyRequest<{ Params: NotificationParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const role = resolveRoleFromJwt(request.user.role);
    const notification = await notificationInboxService.markRead(
      request.params.notificationId,
      request.user.sub,
      role,
    );
    void reply.status(200).send({ success: true, data: { notification } });
  }

  async markAllRead(
    request: FastifyRequest<{ Body: MarkAllReadBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const role = resolveRoleFromJwt(request.user.role);
    const result = await notificationInboxService.markAllRead(
      request.user.sub,
      role,
      request.body?.category,
    );
    void reply.status(200).send({ success: true, data: result });
  }
}

export default new NotificationInboxController();
