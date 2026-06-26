import Store from '@modules/store/store.model';
import type { StoreDiscountBanner } from '@modules/banner/banner.model';
import { NotificationType } from './notification.types';
import { notifyAllAdmins } from './notification.admin';
import { notifyVendor } from './notification.service';

export async function notifyAdminsNewBannerApplication(
  banner: Pick<StoreDiscountBanner, 'id' | 'title' | 'storeId' | 'createdBy'>,
): Promise<void> {
  const store = await Store.findByPk(banner.storeId, { attributes: ['name', 'ownerId'] });

  await notifyAllAdmins(
    NotificationType.ADMIN_BANNER_APPLICATION,
    {
      bannerId: banner.id,
      bannerTitle: banner.title,
      storeId: banner.storeId,
      storeName: store?.name ?? '',
      vendorId: banner.createdBy,
    },
    `admin-banner-application-${banner.id}`,
  );
}

export function notifyVendorBannerApproved(
  vendorUserId: string,
  banner: Pick<StoreDiscountBanner, 'id' | 'title'>,
): void {
  notifyVendor(vendorUserId, NotificationType.VENDOR_BANNER_APPROVED, {
    bannerId: banner.id,
    bannerTitle: banner.title,
  }, {
    jobId: `vendor-banner-approved-${banner.id}-${vendorUserId}`,
  });
}
