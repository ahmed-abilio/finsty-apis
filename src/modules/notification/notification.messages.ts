import { NotificationType, type NotificationContext, type NotificationPayload } from './notification.types';

function str(value: string | number | boolean | null | undefined, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function formatInr(amount: string | number | undefined): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return str(amount, '0');
  return n.toFixed(2);
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  rider_assigned: 'Rider assigned',
  at_store: 'At store',
  picked_up: 'Picked up',
  arrived: 'Arrived',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
};

export function buildNotificationPayload(
  type: NotificationType,
  context: NotificationContext = {},
): NotificationPayload {
  const orderNumber = str(context.orderNumber, str(context.orderId, '').slice(0, 8));
  const amount = formatInr(context.amount as string | number | undefined);
  const statusKey = str(context.status).toLowerCase();
  const statusLabel = ORDER_STATUS_LABELS[statusKey] ?? str(context.statusLabel, statusKey || 'Updated');

  let title = 'Finsty';
  let body = '';

  switch (type) {
    case NotificationType.LOGIN_SUCCESS:
      title = 'Welcome back';
      body = "You're signed in to Finsty.";
      break;
    case NotificationType.ORDER_PLACED:
      title = 'Order placed';
      body = orderNumber
        ? `Your order #${orderNumber} was placed successfully.`
        : 'Your order was placed successfully.';
      break;
    case NotificationType.ORDER_STATUS:
    case NotificationType.ORDER_STATUS_CHANGED:
      title = 'Order update';
      body = orderNumber
        ? `Your order #${orderNumber} is now ${statusLabel}.`
        : `Your order is now ${statusLabel}.`;
      break;
    case NotificationType.PAYMENT_SUCCESS:
      title = 'Payment successful';
      body = orderNumber
        ? `₹${amount} paid for order #${orderNumber}.`
        : `₹${amount} payment was successful.`;
      break;
    case NotificationType.PAYMENT_FAILED:
      title = 'Payment failed';
      body = "We couldn't process your payment. Please try again.";
      break;
    case NotificationType.PAYMENT_CANCELLED:
      title = 'Payment cancelled';
      body = orderNumber
        ? `Payment for order #${orderNumber} was not completed.`
        : 'Your payment was not completed.';
      break;
    case NotificationType.WALLET_CREDITED:
      title = 'Wallet credited';
      body = `₹${amount} was added to your wallet.`;
      break;
    case NotificationType.WALLET_DEBITED:
      title = 'Wallet debited';
      body = `₹${amount} was used from your wallet.`;
      break;
    case NotificationType.CASHBACK_RECEIVED:
      title = 'Cashback received';
      body = `₹${amount} cashback was added to your wallet.`;
      break;
    case NotificationType.REFERRAL_REWARD_CREDITED:
      title = 'Referral reward';
      body = `₹${amount} referral reward was credited to your wallet.`;
      break;
    case NotificationType.COUPON_APPLIED:
      title = 'Coupon applied';
      body = context.code
        ? `You saved ₹${formatInr(context.discount as string | number)} with ${str(context.code)}.`
        : `You saved ₹${formatInr(context.discount as string | number)} on your order.`;
      break;
    case NotificationType.RATE_ORDER_REMINDER:
      title = 'Rate your order';
      body = orderNumber
        ? `How was order #${orderNumber}? Tap to leave a review.`
        : 'How was your experience? Tap to leave a review.';
      break;
    case NotificationType.VENDOR_NEW_ORDER:
      title = 'New order';
      body = orderNumber
        ? `Order #${orderNumber} needs your attention.`
        : 'You have a new order to process.';
      break;
    case NotificationType.VENDOR_LOW_STOCK:
      title = 'Low stock alert';
      body = `${str(context.productName, 'A product')} is running low (${str(context.stock, '0')} left).`;
      break;
    case NotificationType.VENDOR_OUT_OF_STOCK:
      title = 'Out of stock';
      body = `${str(context.productName, 'A product')} is now out of stock.`;
      break;
    case NotificationType.ADMIN_STORE_APPLICATION:
      title = 'New store application';
      body = context.storeName
        ? `${str(context.storeName)} submitted a store application for review.`
        : 'A new store application is waiting for review.';
      break;
    case NotificationType.ADMIN_COUPON_APPLICATION:
      title = 'New coupon for review';
      body = context.couponCode
        ? `Coupon ${str(context.couponCode)} is waiting for approval.`
        : 'A vendor coupon is waiting for approval.';
      break;
    case NotificationType.ADMIN_BANNER_APPLICATION:
      title = 'New banner for review';
      body = context.bannerTitle
        ? `Banner "${str(context.bannerTitle)}" is waiting for approval.`
        : 'A store discount banner is waiting for approval.';
      break;
    case NotificationType.VENDOR_STORE_APPROVED:
      title = 'Store approved';
      body = context.storeName
        ? `${str(context.storeName)} is now approved and active on Finsty.`
        : 'Your store application was approved.';
      break;
    case NotificationType.VENDOR_STORE_REJECTED:
      title = 'Store application rejected';
      body = context.storeName
        ? `${str(context.storeName)} application was not approved.`
        : 'Your store application was not approved.';
      break;
    case NotificationType.VENDOR_COUPON_APPROVED:
      title = 'Coupon approved';
      body = context.couponCode
        ? `Coupon ${str(context.couponCode)} is now live.`
        : 'Your coupon was approved.';
      break;
    case NotificationType.VENDOR_BANNER_APPROVED:
      title = 'Banner approved';
      body = context.bannerTitle
        ? `Banner "${str(context.bannerTitle)}" is now live.`
        : 'Your store discount banner was approved.';
      break;
    case NotificationType.VENDOR_ORDER_CANCELLED:
      title = 'Order cancelled';
      body = orderNumber
        ? `Order #${orderNumber} was cancelled.`
        : 'An order for your store was cancelled.';
      break;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      body = 'You have a new notification.';
    }
  }

  const data: Record<string, string> = {
    type,
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
  };

  for (const [key, value] of Object.entries(context)) {
    if (value !== null && value !== undefined) {
      data[key] = String(value);
    }
  }

  return { title, body, data };
}
