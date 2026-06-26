import Store from '@modules/store/store.model';
import type Coupon from '@modules/coupon/coupon.model';
import { NotificationType } from './notification.types';
import { notifyAllAdmins } from './notification.admin';
import { notifyVendor } from './notification.service';

export async function notifyAdminsNewCouponApplication(
  coupon: Pick<Coupon, 'id' | 'code' | 'storeId' | 'createdBy'>,
): Promise<void> {
  let storeName = '';
  if (coupon.storeId) {
    const store = await Store.findByPk(coupon.storeId, { attributes: ['name'] });
    storeName = store?.name ?? '';
  }

  await notifyAllAdmins(
    NotificationType.ADMIN_COUPON_APPLICATION,
    {
      couponId: coupon.id,
      couponCode: coupon.code,
      storeId: coupon.storeId ?? '',
      storeName,
      vendorId: coupon.createdBy,
    },
    `admin-coupon-application-${coupon.id}`,
  );
}

export function notifyVendorCouponApproved(
  vendorUserId: string,
  coupon: Pick<Coupon, 'id' | 'code'>,
): void {
  notifyVendor(vendorUserId, NotificationType.VENDOR_COUPON_APPROVED, {
    couponId: coupon.id,
    couponCode: coupon.code,
  }, {
    jobId: `vendor-coupon-approved-${coupon.id}-${vendorUserId}`,
  });
}
