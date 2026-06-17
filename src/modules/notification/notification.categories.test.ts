import { describe, expect, it } from 'vitest';
import { Roles } from '@modules/user/user.model';
import { NotificationType } from './notification.types';
import {
  isCategoryAllowedForRole,
  listCategoriesForRole,
  resolveNotificationCategory,
} from './notification.categories';

describe('resolveNotificationCategory', () => {
  it('maps vendor order and inventory types', () => {
    expect(resolveNotificationCategory(NotificationType.VENDOR_NEW_ORDER, Roles.VENDOR)).toBe('orders');
    expect(resolveNotificationCategory(NotificationType.VENDOR_LOW_STOCK, Roles.VENDOR)).toBe('inventory');
    expect(resolveNotificationCategory(NotificationType.VENDOR_OUT_OF_STOCK, Roles.VENDOR)).toBe('inventory');
  });

  it('maps customer wallet and payment types', () => {
    expect(resolveNotificationCategory(NotificationType.WALLET_CREDITED, Roles.USER)).toBe('wallet');
    expect(resolveNotificationCategory(NotificationType.PAYMENT_SUCCESS, Roles.USER)).toBe('payments');
  });
});

describe('listCategoriesForRole', () => {
  it('returns vendor filter categories', () => {
    expect(listCategoriesForRole(Roles.VENDOR)).toEqual(['orders', 'inventory', 'account']);
  });

  it('validates vendor category filter', () => {
    expect(isCategoryAllowedForRole(Roles.VENDOR, 'orders')).toBe(true);
    expect(isCategoryAllowedForRole(Roles.VENDOR, 'payments')).toBe(false);
  });
});
