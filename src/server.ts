import 'dotenv/config';
import '@config/associations'; // register all model associations before any query runs

import sequelize from '@config/database';
import redis from '@config/redis';
import { buildApp } from './app';
import logger from '@utils/logger';
import {
  fixMissingSlugs,
  fixBrandConstraints,
  ensureOrderIdColumn,
  ensureVariantSizeChartColumn,
} from '@utils/maintenance';
import { scheduleOrderExpiryJob } from '@queues/orderExpiryQueue';
import { scheduleShadowfaxReconciliationJob } from '@queues/shadowfaxReconciliationQueue';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function start() {
  try {
    const startupTime = Date.now();

    // ── Connect Services in Parallel ──────────────────────────────────────────
    const [app] = await Promise.all([
      buildApp(),
      redis.connect().then(() => logger.info('Redis connected')),
      sequelize.authenticate().then(() => logger.info('PostgreSQL connected')),
    ]);

    await fixMissingSlugs(sequelize);
    await ensureOrderIdColumn(sequelize);
    await ensureVariantSizeChartColumn(sequelize);
    await scheduleOrderExpiryJob();
    await scheduleShadowfaxReconciliationJob();

    // ── Optional dev sync (disabled by default) ───────────────────────────────
    // For schema-breaking migrations, auto `alter` can fail before migrations run.
    // Enable only when intentionally doing model-first development.
    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_SYNC === 'true') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }

    // Run after sync so dev alter does not leave global brand name uniqueness behind.
    await fixBrandConstraints(sequelize);

    // Start queue workers after schema safety fixes are done.
    await Promise.all([
      import('@queues/orderWorker'),
      import('@queues/orderExpiryWorker'),
      import('@queues/shadowfaxWorker'),
      import('@queues/shadowfaxReconciliationWorker'),
      import('@queues/notificationWorker'),
    ]);

    // ── Start Fastify ────────────────────────────────────────────────────────
    await app.listen({ port: PORT, host: HOST });
    
    const duration = Date.now() - startupTime;
    logger.info(`Server started in ${duration}ms on http://${HOST}:${PORT}`);
    logger.info(`Swagger docs at http://${HOST}:${PORT}/docs`);
    logger.info(`Bull Board at http://${HOST}:${PORT}/admin/queues`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void start();

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');
  try {
    await sequelize.close();
    await redis.quit();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});
