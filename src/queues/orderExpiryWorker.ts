import 'dotenv/config';
import { Worker } from 'bullmq';
import { Op } from 'sequelize';
import { getWorkerOptions } from '@config/bullmq';
import Order from '@modules/order/order.model';
import orderService from '@modules/order/order.service';
import { AppError } from '@utils/appError';
import logger from '@utils/logger';
import { ORDER_EXPIRY_QUEUE_NAME } from './orderExpiryQueue';

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const worker = new Worker(
  ORDER_EXPIRY_QUEUE_NAME,
  async (job) => {
    const cutoff = new Date(Date.now() - EXPIRY_MS);

    const expiredOrders = await Order.findAll({
      where: {
        status: 'pending',
        createdAt: { [Op.lt]: cutoff },
      },
      attributes: ['id', 'userId'],
    });

    if (!expiredOrders.length) {
      logger.info({ jobId: job.id }, 'No expired pending orders found');
      return;
    }

    logger.info({ jobId: job.id, count: expiredOrders.length }, 'Cancelling abandoned pending orders');

    for (const order of expiredOrders) {
      try {
        await orderService.cancelOrder(order.id, order.userId as string);
        logger.info({ orderId: order.id, userId: order.userId }, 'Abandoned order auto-cancelled');
      } catch (err) {
        if (err instanceof AppError && (err.code === 'ORDER_NOT_CANCELLABLE' || err.code === 'ORDER_NOT_FOUND')) {
          // Order was already cancelled or transitioned — expected race with the cancel endpoint
          continue;
        }
        logger.error({ orderId: order.id, err }, 'Failed to auto-cancel expired order');
      }
    }
  },
  getWorkerOptions(),
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Order expiry job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Order expiry job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Order expiry worker error');
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down order expiry worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down order expiry worker...');
  await worker.close();
  process.exit(0);
});

logger.info('Order expiry worker started');

export default worker;
