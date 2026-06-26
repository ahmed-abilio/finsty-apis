import { Op, type FindOptions, type WhereOptions } from 'sequelize';
import sequelize from '@config/database';
import Order from './order.model';
import Store from '@modules/store/store.model';
import type { ShadowfaxCancelUser } from '@modules/shadowfax/shadowfaxCancel.types';
import { AppError } from '@utils/appError';

export interface OrderCaller {
  userId: string;
  role: string;
}

/**
 * Resolves an order for the authenticated caller (buyer, vendor store, or admin).
 */
export async function findOrderForCaller<T extends Order>(
  orderRefWhere: WhereOptions,
  caller: OrderCaller,
  options: Omit<FindOptions<T>, 'where'> = {},
): Promise<T | null> {
  if (caller.role === 'admin') {
    return Order.findOne({ where: orderRefWhere, ...options }) as Promise<T | null>;
  }

  if (caller.role === 'vendor') {
    const store = await Store.findOne({ where: { ownerId: caller.userId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    const storeOrderIds = sequelize.literal(
      `(SELECT DISTINCT oi.order_id FROM order_items oi INNER JOIN products p ON p.id = oi.product_id WHERE p.store_id = ${sequelize.escape(store.id)})`,
    );

    return Order.findOne({
      where: {
        [Op.and]: [orderRefWhere, { id: { [Op.in]: storeOrderIds } }],
      },
      ...options,
    }) as Promise<T | null>;
  }

  return Order.findOne({
    where: { ...orderRefWhere, userId: caller.userId },
    ...options,
  }) as Promise<T | null>;
}

export function resolveShadowfaxCancelActor(
  role: string,
  requested?: ShadowfaxCancelUser,
): ShadowfaxCancelUser {
  if (role === 'vendor') {
    if (requested && requested !== 'Seller') {
      throw AppError.badRequest(
        'Vendor cancellations must set user to "Seller"',
        'INVALID_CANCEL_ACTOR',
      );
    }
    return 'Seller';
  }

  if (requested && requested !== 'Customer') {
    throw AppError.badRequest(
      'Buyer cancellations must set user to "Customer"',
      'INVALID_CANCEL_ACTOR',
    );
  }
  return 'Customer';
}
