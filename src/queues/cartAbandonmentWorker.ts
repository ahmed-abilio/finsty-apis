import 'dotenv/config';
import { Worker } from 'bullmq';
import { QueryTypes } from 'sequelize';
import sequelize from '@config/database';
import redis from '@config/redis';
import { getWorkerOptions } from '@config/bullmq';
import User from '@modules/user/user.model';
import { notifyCartAbandonment } from '@modules/notification/notification.cart';
import logger from '@utils/logger';
import { CART_ABANDONMENT_QUEUE_NAME } from './cartAbandonmentQueue';

const IDLE_MS = Number(process.env.CART_ABANDON_IDLE_MS ?? 3_600_000);
const INACTIVE_MS = Number(process.env.CART_ABANDON_INACTIVE_MS ?? 300_000);
const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

interface IdleCartRow {
  userId: string;
  cartId: string;
  lastCartActivity: Date | string;
  itemCount: number | string;
}

function notifiedKey(userId: string): string {
  return `cart-abandon-notified:${userId}`;
}

function fingerprint(cartId: string, lastCartActivity: Date | string): string {
  const ms = new Date(lastCartActivity).getTime();
  return `${cartId}:${ms}`;
}

const worker = new Worker(
  CART_ABANDONMENT_QUEUE_NAME,
  async (job) => {
    const idleCutoff = new Date(Date.now() - IDLE_MS);
    const inactiveCutoff = new Date(Date.now() - INACTIVE_MS);

    const rows = await sequelize.query<IdleCartRow>(
      `
        SELECT
          c.user_id AS "userId",
          c.id AS "cartId",
          MAX(ci."updatedAt") AS "lastCartActivity",
          COUNT(ci.id)::int AS "itemCount"
        FROM carts c
        INNER JOIN cart_items ci ON ci.cart_id = c.id
        GROUP BY c.id, c.user_id
        HAVING MAX(ci."updatedAt") <= :idleCutoff
      `,
      {
        replacements: { idleCutoff },
        type: QueryTypes.SELECT,
      },
    );

    if (!rows.length) {
      logger.info({ jobId: job.id }, 'No idle abandoned carts found');
      return;
    }

    const users = await User.findAll({
      where: { id: rows.map((r) => r.userId) },
      attributes: ['id', 'lastActiveAt'],
    });
    const lastActiveByUser = new Map(
      users.map((u) => [u.id, u.lastActiveAt ? new Date(u.lastActiveAt) : null]),
    );

    let sent = 0;
    let skippedActive = 0;
    let skippedDedupe = 0;

    for (const row of rows) {
      const lastActive = lastActiveByUser.get(row.userId);
      if (lastActive && lastActive > inactiveCutoff) {
        skippedActive += 1;
        continue;
      }

      const fp = fingerprint(row.cartId, row.lastCartActivity);
      const key = notifiedKey(row.userId);
      const previous = await redis.get(key);
      if (previous === fp) {
        skippedDedupe += 1;
        continue;
      }

      const itemCount = Number(row.itemCount) || 0;
      notifyCartAbandonment(row.userId, itemCount);
      await redis.set(key, fp, 'EX', DEDUPE_TTL_SECONDS);
      sent += 1;
    }

    logger.info(
      {
        jobId: job.id,
        candidates: rows.length,
        sent,
        skippedActive,
        skippedDedupe,
        idleMs: IDLE_MS,
        inactiveMs: INACTIVE_MS,
      },
      'Cart abandonment scan completed',
    );
  },
  getWorkerOptions(),
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Cart abandonment job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Cart abandonment job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Cart abandonment worker error');
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down cart abandonment worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down cart abandonment worker...');
  await worker.close();
  process.exit(0);
});

logger.info('Cart abandonment worker started');

export default worker;
