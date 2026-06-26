import type Store from '@modules/store/store.model';
import { NotificationType } from './notification.types';
import { notifyAllAdmins } from './notification.admin';
import { notifyVendor } from './notification.service';

/** Notify every active admin that a vendor store application needs review. */
export async function notifyAdminsNewStoreApplication(
  store: Pick<Store, 'id' | 'name' | 'ownerId' | 'city'>,
): Promise<void> {
  await notifyAllAdmins(
    NotificationType.ADMIN_STORE_APPLICATION,
    {
      storeId: store.id,
      storeName: store.name,
      ownerId: store.ownerId ?? '',
      city: store.city ?? '',
    },
    `admin-store-application-${store.id}`,
  );
}

export function notifyVendorStoreReviewResult(
  store: Pick<Store, 'id' | 'name' | 'ownerId'>,
  status: 'APPROVED' | 'REJECTED',
  remarks?: string,
): void {
  if (!store.ownerId) return;

  const type =
    status === 'APPROVED'
      ? NotificationType.VENDOR_STORE_APPROVED
      : NotificationType.VENDOR_STORE_REJECTED;

  notifyVendor(
    store.ownerId,
    type,
    {
      storeId: store.id,
      storeName: store.name,
      ...(remarks ? { remarks } : {}),
    },
    { jobId: `vendor-store-${status.toLowerCase()}-${store.id}` },
  );
}
