import type { Transaction } from 'sequelize';
import OrderStatusHistory from './order-status-history.model';

export async function appendOrderStatusHistory(data: {
  orderId: string;
  oldStatus: string;
  newStatus: string;
  source: string;
  remarks?: string | null;
  payload?: object | null;
  transaction?: Transaction;
}): Promise<OrderStatusHistory> {
  return OrderStatusHistory.create(
    {
      orderId: data.orderId,
      oldStatus: data.oldStatus,
      newStatus: data.newStatus,
      source: data.source,
      remarks: data.remarks ?? null,
      payload: data.payload ?? null,
    },
    { transaction: data.transaction },
  );
}

export async function findHistoryByOrderId(orderId: string): Promise<OrderStatusHistory[]> {
  return OrderStatusHistory.findAll({
    where: { orderId },
    order: [['createdAt', 'ASC']],
  });
}
