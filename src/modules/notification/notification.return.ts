import { NotificationType } from './notification.types';
import { formatOrderNumber, notifyUser, notifyVendor } from './notification.service';
import Store from '@modules/store/store.model';

export function notifyReturnRequested(
  userId: string,
  orderId: string,
  returnId: string,
): void {
  notifyUser(
    userId,
    NotificationType.RETURN_REQUESTED,
    {
      orderId,
      returnId,
      orderNumber: formatOrderNumber(orderId),
    },
    { jobId: `return-requested-${returnId}` },
  );
}

export async function notifyVendorReturnReceived(
  storeId: string,
  orderId: string,
  returnId: string,
): Promise<void> {
  const store = await Store.findByPk(storeId, { attributes: ['ownerId'] });
  if (!store?.ownerId) return;

  notifyVendor(
    store.ownerId,
    NotificationType.VENDOR_RETURN_RECEIVED,
    {
      orderId,
      returnId,
      orderNumber: formatOrderNumber(orderId),
    },
    { jobId: `vendor-return-received-${returnId}` },
  );
}

export function notifyReturnRefundApproved(
  userId: string,
  orderId: string,
  returnId: string,
  amount: number,
): void {
  notifyUser(
    userId,
    NotificationType.RETURN_REFUND_APPROVED,
    {
      orderId,
      returnId,
      orderNumber: formatOrderNumber(orderId),
      amount: amount.toFixed(2),
    },
    { jobId: `return-refund-approved-${returnId}` },
  );
}

export function notifyReturnRefundRejected(
  userId: string,
  orderId: string,
  returnId: string,
  reason?: string,
): void {
  notifyUser(
    userId,
    NotificationType.RETURN_REFUND_REJECTED,
    {
      orderId,
      returnId,
      orderNumber: formatOrderNumber(orderId),
      reason: reason ?? '',
    },
    { jobId: `return-refund-rejected-${returnId}` },
  );
}
