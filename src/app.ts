import 'dotenv/config';
import { default as Fastify, FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import type { BaseAdapter } from '@bull-board/api/dist/src/queueAdapters/base';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter as BullBoardFastifyAdapter } from '@bull-board/fastify';

import swaggerPlugin from '@plugins/swagger';
import corsPlugin from '@plugins/cors';
import helmetPlugin from '@plugins/helmet';
import multipartPlugin from '@plugins/multipart';
import authGuardPlugin from '@plugins/authGuard';
import authenticatePlugin from '@middlewares/authenticate';
import rateLimiterPlugin from '@middlewares/rateLimiter';

import authRoutes from '@modules/auth/auth.routes';
import userRoutes from '@modules/user/user.routes';
import mediaRoutes from '@modules/media/media.routes';
import addressRoutes from '@modules/address/address.routes';
import storeRoutes from '@modules/store/store.routes';
import cartRoutes from '@modules/cart/cart.routes';
import orderRoutes, { adminOrderRoutes } from '@modules/order/order.routes';
import productRoutes from '@modules/product/product.routes';
import { productReviewRoutes, reviewActionRoutes, adminReviewRoutes } from '@modules/review/review.routes';
import { storeReviewRoutes, adminStoreReviewRoutes } from '@modules/store-review/store-review.routes';
import categoryRoutes from '@modules/category/category.routes';
import { subCategoryNestedRoutes, subCategoryFlatRoutes } from '@modules/sub-category/sub-category.routes';
import wishlistRoutes from '@modules/wishlist/wishlist.routes';
import walletRoutes from '@modules/wallet/wallet.routes';
import paymentRoutes from '@modules/payment/payment.routes';
import otpRoutes from '@modules/otp/otp.routes';
import { couponRoutes, adminCouponRoutes } from '@modules/coupon/coupon.routes';
import { adminBannerRoutes, publicBannerRoutes } from '@modules/banner/banner.routes';
import brandRoutes from '@modules/brand/brand.routes';
import shadowfaxRoutes from '@modules/shadowfax/shadowfax.routes';
import shadowfaxWebhookRoutes from '@modules/shadowfax/tracking/shadowfax-webhook.routes';
import platformSettingsAdminRoutes from '@modules/platform-settings/platform-settings.admin.routes';
import configRoutes from '@modules/config/config.routes';
import notificationInboxRoutes from '@modules/notification/notification.inbox.routes';
import { cmsRoutes, adminCmsRoutes } from '@modules/cms/cms.routes';

import emailQueue from '@queues/emailQueue';
import orderQueue from '@queues/orderQueue';
import orderExpiryQueue from '@queues/orderExpiryQueue';
import shadowfaxQueue from '@queues/shadowfaxQueue';
import shadowfaxReconciliationQueue from '@queues/shadowfaxReconciliationQueue';
import notificationQueue from '@queues/notificationQueue';
import { getShadowfaxMetrics } from '@observability/shadowfax.metrics';
import { formatError } from './utils/errorFormatter';

const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';
const ADMIN_QUEUE_PATH = '/admin/queues';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV !== 'production' ? 'debug' : 'info'),
      ...(process.env.NODE_ENV !== 'production'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
            },
          }
        : {}),
    },
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: 'array',
        allErrors: true,
      },
    },
  });

  // ── Swagger (register before routes so schemas are collected) ──────────────
  await fastify.register(swaggerPlugin);

  // ── Security & transport ──────────────────────────────────────────────────
  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(multipartPlugin);

  // ── Auth decorator & rate limiter ─────────────────────────────────────────
  await fastify.register(authenticatePlugin);
  await fastify.register(authGuardPlugin);
  await fastify.register(rateLimiterPlugin);

  // ── Health check ──────────────────────────────────────────────────────────
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      void reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    },
  );

  fastify.get(
    '/health/shadowfax',
    {
      schema: {
        tags: ['Health'],
        summary: 'Shadowfax webhook and reconciliation metrics',
        response: {
          200: {
            type: 'object',
            properties: {
              metrics: { type: 'object', additionalProperties: { type: 'number' } },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      void reply.send({ metrics: getShadowfaxMetrics() });
    },
  );

  // ── Global error handler ──────────────────────────────────────────────────
  fastify.setErrorHandler(formatError);

  // ── API routes ────────────────────────────────────────────────────────────
  await fastify.register(authRoutes, { prefix: `${API_PREFIX}/auth` });
  await fastify.register(userRoutes, { prefix: `${API_PREFIX}/users` });
  await fastify.register(mediaRoutes, { prefix: `${API_PREFIX}/media` });
  await fastify.register(addressRoutes, { prefix: `${API_PREFIX}/addresses` });
  await fastify.register(storeRoutes, { prefix: `${API_PREFIX}/stores` });
  await fastify.register(storeReviewRoutes, { prefix: `${API_PREFIX}/stores` });
  await fastify.register(adminStoreReviewRoutes, { prefix: `${API_PREFIX}/admin/store-reviews` });
  await fastify.register(cartRoutes, { prefix: `${API_PREFIX}/cart` });
  await fastify.register(orderRoutes, { prefix: `${API_PREFIX}/orders` });
  await fastify.register(productRoutes, { prefix: `${API_PREFIX}/products` });
  await fastify.register(productReviewRoutes, { prefix: `${API_PREFIX}/products` });
  await fastify.register(reviewActionRoutes, { prefix: `${API_PREFIX}/reviews` });
  await fastify.register(adminReviewRoutes, { prefix: `${API_PREFIX}/admin/reviews` });
  await fastify.register(categoryRoutes, { prefix: `${API_PREFIX}/categories` });
  await fastify.register(subCategoryNestedRoutes, { prefix: `${API_PREFIX}/categories` });
  await fastify.register(subCategoryFlatRoutes, { prefix: `${API_PREFIX}/sub-categories` });
  await fastify.register(wishlistRoutes, { prefix: `${API_PREFIX}/wishlist` });
  await fastify.register(walletRoutes, { prefix: `${API_PREFIX}/wallet` });
  await fastify.register(paymentRoutes, { prefix: `${API_PREFIX}/payments` });
  await fastify.register(otpRoutes, { prefix: `${API_PREFIX}/otp` });
  await fastify.register(couponRoutes, { prefix: `${API_PREFIX}/coupons` });
  await fastify.register(adminCouponRoutes, { prefix: `${API_PREFIX}/admin/coupons` });
  await fastify.register(adminOrderRoutes, { prefix: `${API_PREFIX}/admin/orders` });
  await fastify.register(adminBannerRoutes, { prefix: `${API_PREFIX}/admin/banners` });
  await fastify.register(publicBannerRoutes, { prefix: `${API_PREFIX}/banners` });
  await fastify.register(brandRoutes, { prefix: `${API_PREFIX}/stores` });
  await fastify.register(shadowfaxRoutes, { prefix: `${API_PREFIX}/shadowfax` });
  await fastify.register(shadowfaxWebhookRoutes, { prefix: '/api/webhooks' });
  await fastify.register(platformSettingsAdminRoutes, {
    prefix: `${API_PREFIX}/admin/platform-settings`,
  });
  await fastify.register(configRoutes, { prefix: `${API_PREFIX}/config` });
  await fastify.register(cmsRoutes, { prefix: `${API_PREFIX}/cms` });
  await fastify.register(adminCmsRoutes, { prefix: `${API_PREFIX}/admin/cms` });
  await fastify.register(notificationInboxRoutes, { prefix: `${API_PREFIX}/notifications` });

  // ── Bull Board admin UI ───────────────────────────────────────────────────
  const serverAdapter = new BullBoardFastifyAdapter();

  createBullBoard({
    queues: [
      new BullMQAdapter(emailQueue) as unknown as BaseAdapter,
      new BullMQAdapter(orderQueue) as unknown as BaseAdapter,
      new BullMQAdapter(orderExpiryQueue) as unknown as BaseAdapter,
      new BullMQAdapter(shadowfaxQueue) as unknown as BaseAdapter,
      new BullMQAdapter(shadowfaxReconciliationQueue) as unknown as BaseAdapter,
      new BullMQAdapter(notificationQueue) as unknown as BaseAdapter,
    ],
    serverAdapter,
  });

  serverAdapter.setBasePath(ADMIN_QUEUE_PATH);

  await fastify.register(serverAdapter.registerPlugin(), {
    prefix: ADMIN_QUEUE_PATH,
    basePath: ADMIN_QUEUE_PATH,
  });

  // Protect admin routes with API key
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith(ADMIN_QUEUE_PATH)) {
      await fastify.adminGuard(request, reply);
    }
  });


  // ── 404 handler ───────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  return fastify;
}
