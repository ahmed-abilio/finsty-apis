import { NotificationType } from './notification.types';
import { notifyUser } from './notification.service';

export function notifyCartAbandonment(userId: string, itemCount: number): void {
  notifyUser(userId, NotificationType.CART_ABANDONMENT, { itemCount });
}
