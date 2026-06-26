import { AdminRoleUser } from '@modules/user/role-user.model';
import logger from '@utils/logger';
import type { NotificationContext, NotificationType } from './notification.types';
import { notifyAdmin } from './notification.service';

/** Enqueue the same notification for every active admin account. */
export async function notifyAllAdmins(
  type: NotificationType,
  context: NotificationContext,
  jobIdPrefix: string,
): Promise<void> {
  const admins = await AdminRoleUser.findAll({
    where: { isActive: true },
    attributes: ['id'],
  });

  if (!admins.length) {
    logger.warn({ type, jobIdPrefix }, 'No active admin users to notify');
    return;
  }

  for (const admin of admins) {
    notifyAdmin(admin.id, type, context, {
      jobId: `${jobIdPrefix}-${admin.id}`,
    });
  }
}
