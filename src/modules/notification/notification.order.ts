import OrderItem from '@modules/order/order-item.model';
import Product from '@modules/product/product.model';
import Store from '@modules/store/store.model';
import logger from '@utils/logger';
import { NotificationType } from './notification.types';
import { formatOrderNumber, notifyUser, notifyVendor } from './notification.service';

export function notifyBuyerOrderStatus(userId: string, orderId: string, status: string): void {
  notifyUser(userId, NotificationType.ORDER_STATUS, {
    orderId,
    orderNumber: formatOrderNumber(orderId),
    status,
  });
}

/** Checkout dismissed or order cancelled before payment completed. */
export function notifyPaymentCancelled(userId: string, orderId: string): void {
  notifyUser(
    userId,
    NotificationType.PAYMENT_CANCELLED,
    { orderId, orderNumber: formatOrderNumber(orderId) },
    { jobId: `payment-cancelled-${orderId}` },
  );
}

/** Buyer + vendor pushes after payment confirms the order (not on pending checkout). */
export async function notifyOrderPlacedAfterPayment(userId: string, orderId: string): Promise<void> {
  const orderNumber = formatOrderNumber(orderId);
  notifyUser(userId, NotificationType.ORDER_PLACED, { orderId, orderNumber });

  const items = await OrderItem.findAll({
    where: { orderId },
    attributes: ['productId'],
  });
  const productIds = items.map((row) => row.productId);

  await notifyVendorsNewOrder(orderId, productIds).catch((err) => {
    logger.error({ err, orderId }, 'Failed to enqueue vendor new-order notifications');
  });
}

export async function notifyVendorsNewOrder(orderId: string, productIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  const products = await Product.findAll({
    where: { id: uniqueIds },
    attributes: ['id'],
    include: [{ model: Store, as: 'store', attributes: ['ownerId'] }],
  });

  const orderNumber = formatOrderNumber(orderId);
  const ownerIds = new Set<string>();

  for (const row of products) {
    const store = (row as Product & { store?: Store }).store;
    if (store?.ownerId) ownerIds.add(store.ownerId);
  }

  for (const vendorUserId of ownerIds) {
    notifyVendor(vendorUserId, NotificationType.VENDOR_NEW_ORDER, { orderId, orderNumber });
  }
}

export function scheduleRateOrderReminder(userId: string, orderId: string): void {
  const delayMs = Number(process.env.NOTIFICATION_RATE_ORDER_DELAY_MS ?? 86400000);
  notifyUser(
    userId,
    NotificationType.RATE_ORDER_REMINDER,
    { orderId, orderNumber: formatOrderNumber(orderId) },
    { delayMs, jobId: `rate-order-${orderId}` },
  );
}
