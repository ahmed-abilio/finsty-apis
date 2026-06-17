import type { Roles } from '@modules/user/user.model';

export type NotificationRole = Roles.USER | Roles.VENDOR | Roles.ADMIN;

export const NotificationType = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_STATUS: 'ORDER_STATUS',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  WALLET_CREDITED: 'WALLET_CREDITED',
  WALLET_DEBITED: 'WALLET_DEBITED',
  CASHBACK_RECEIVED: 'CASHBACK_RECEIVED',
  REFERRAL_REWARD_CREDITED: 'REFERRAL_REWARD_CREDITED',
  COUPON_APPLIED: 'COUPON_APPLIED',
  RATE_ORDER_REMINDER: 'RATE_ORDER_REMINDER',
  VENDOR_NEW_ORDER: 'VENDOR_NEW_ORDER',
  VENDOR_LOW_STOCK: 'VENDOR_LOW_STOCK',
  VENDOR_OUT_OF_STOCK: 'VENDOR_OUT_OF_STOCK',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export type NotificationContext = Record<string, string | number | boolean | null | undefined>;

export interface NotificationPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}
