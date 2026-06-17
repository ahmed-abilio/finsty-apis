import OrderStatusHistory from './order-status-history.model';

export async function appendOrderStatusHistory(data: {
  orderId: string;
  oldStatus: string;
  newStatus: string;
  source: string;
  remarks?: string | null;
  payload?: object | null;
}): Promise<OrderStatusHistory> {
  return OrderStatusHistory.create({
    orderId: data.orderId,
    oldStatus: data.oldStatus,
    newStatus: data.newStatus,
    source: data.source,
    remarks: data.remarks ?? null,
    payload: data.payload ?? null,
  });
}

export async function findHistoryByOrderId(orderId: string): Promise<OrderStatusHistory[]> {
  return OrderStatusHistory.findAll({
    where: { orderId },
    order: [['createdAt', 'ASC']],
  });
}
