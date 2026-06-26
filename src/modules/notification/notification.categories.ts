import { Roles } from '@modules/user/user.model';
import { NotificationType } from './notification.types';
import type { NotificationCategory } from './notification-inbox.model';
import type { NotificationRole } from './notification.types';

export const VENDOR_NOTIFICATION_CATEGORIES = ['orders', 'inventory', 'promotions', 'account'] as const;
export const USER_NOTIFICATION_CATEGORIES = [
  'orders',
  'payments',
  'wallet',
  'promotions',
  'account',
] as const;
export const ADMIN_NOTIFICATION_CATEGORIES = ['account', 'general'] as const;

export type VendorNotificationCategory = (typeof VENDOR_NOTIFICATION_CATEGORIES)[number];
export type UserNotificationCategory = (typeof USER_NOTIFICATION_CATEGORIES)[number];
export type AdminNotificationCategory = (typeof ADMIN_NOTIFICATION_CATEGORIES)[number];

const TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  [NotificationType.LOGIN_SUCCESS]: 'account',
  [NotificationType.ORDER_PLACED]: 'orders',
  [NotificationType.ORDER_STATUS]: 'orders',
  [NotificationType.ORDER_STATUS_CHANGED]: 'orders',
  [NotificationType.PAYMENT_SUCCESS]: 'payments',
  [NotificationType.PAYMENT_FAILED]: 'payments',
  [NotificationType.PAYMENT_CANCELLED]: 'payments',
  [NotificationType.WALLET_CREDITED]: 'wallet',
  [NotificationType.WALLET_DEBITED]: 'wallet',
  [NotificationType.CASHBACK_RECEIVED]: 'wallet',
  [NotificationType.REFERRAL_REWARD_CREDITED]: 'wallet',
  [NotificationType.COUPON_APPLIED]: 'promotions',
  [NotificationType.RATE_ORDER_REMINDER]: 'orders',
  [NotificationType.VENDOR_NEW_ORDER]: 'orders',
  [NotificationType.VENDOR_LOW_STOCK]: 'inventory',
  [NotificationType.VENDOR_OUT_OF_STOCK]: 'inventory',
  [NotificationType.ADMIN_STORE_APPLICATION]: 'general',
  [NotificationType.ADMIN_COUPON_APPLICATION]: 'general',
  [NotificationType.ADMIN_BANNER_APPLICATION]: 'general',
  [NotificationType.VENDOR_STORE_APPROVED]: 'account',
  [NotificationType.VENDOR_STORE_REJECTED]: 'account',
  [NotificationType.VENDOR_COUPON_APPROVED]: 'promotions',
  [NotificationType.VENDOR_BANNER_APPROVED]: 'promotions',
  [NotificationType.VENDOR_ORDER_CANCELLED]: 'orders',
};

export function resolveNotificationCategory(
  type: NotificationType,
  _role: NotificationRole,
): NotificationCategory {
  return TYPE_CATEGORY[type] ?? 'general';
}

export function listCategoriesForRole(role: NotificationRole): readonly NotificationCategory[] {
  switch (role) {
    case Roles.VENDOR:
      return VENDOR_NOTIFICATION_CATEGORIES;
    case Roles.ADMIN:
      return ADMIN_NOTIFICATION_CATEGORIES;
    default:
      return USER_NOTIFICATION_CATEGORIES;
  }
}

export function isCategoryAllowedForRole(
  role: NotificationRole,
  category: NotificationCategory,
): boolean {
  return (listCategoriesForRole(role) as readonly string[]).includes(category);
}
