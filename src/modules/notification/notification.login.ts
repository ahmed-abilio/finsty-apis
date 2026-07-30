import { Roles } from '@modules/user/user.model';
import { NotificationType } from './notification.types';
import { notifyAdmin, notifyUser, notifyVendor } from './notification.service';
import logger from '@utils/logger';

export type LoginGreeting = 'welcome' | 'welcome_back';

/** Show "Welcome back" only when the previous login was at least this many days ago. */
export const WELCOME_BACK_AFTER_DAYS = 12;

const WELCOME_BACK_AFTER_MS = WELCOME_BACK_AFTER_DAYS * 24 * 60 * 60 * 1000;

export function resolveLoginGreeting(params: {
  isNew: boolean;
  lastLoginAt: Date | string | null | undefined;
  now?: Date;
}): LoginGreeting | null {
  const now = params.now ?? new Date();

  // First-time account or never recorded a login → welcome only
  if (params.isNew || !params.lastLoginAt) {
    return 'welcome';
  }

  const previous = new Date(params.lastLoginAt);
  if (Number.isNaN(previous.getTime())) {
    return 'welcome';
  }

  const elapsed = now.getTime() - previous.getTime();
  if (elapsed >= WELCOME_BACK_AFTER_MS) {
    return 'welcome_back';
  }

  // Re-login within 12 days → no welcome notification
  return null;
}

type LoginUser = {
  id: string;
  lastLoginAt?: Date | null;
  update: (values: { lastLoginAt: Date }) => Promise<unknown>;
};

/**
 * Records `lastLoginAt`, then notifies only for first login ("Welcome to Finsty")
 * or when returning after 12+ days ("Welcome back").
 */
export async function recordLoginAndNotify(params: {
  user: LoginUser;
  role: Roles.USER | Roles.VENDOR | Roles.ADMIN;
  isNew: boolean;
}): Promise<LoginGreeting | null> {
  const previousLastLoginAt = params.user.lastLoginAt ?? null;
  const greeting = resolveLoginGreeting({
    isNew: params.isNew,
    lastLoginAt: previousLastLoginAt,
  });

  try {
    await params.user.update({ lastLoginAt: new Date() });
  } catch (err) {
    logger.error({ err, userId: params.user.id }, 'Failed to update lastLoginAt');
  }

  if (!greeting) return null;

  const context = { loginGreeting: greeting };
  if (params.role === Roles.VENDOR) {
    notifyVendor(params.user.id, NotificationType.LOGIN_SUCCESS, context);
  } else if (params.role === Roles.ADMIN) {
    notifyAdmin(params.user.id, NotificationType.LOGIN_SUCCESS, context);
  } else {
    notifyUser(params.user.id, NotificationType.LOGIN_SUCCESS, context);
  }

  return greeting;
}
