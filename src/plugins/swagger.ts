import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';

async function swaggerPlugin(fastify: FastifyInstance): Promise<void> {
  const port = process.env.PORT ?? '3000';
  const isProduction = process.env.NODE_ENV === 'production';

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'finsty API',
        description:
          'Production-grade REST API built with Fastify, PostgreSQL, Redis, Firebase Auth, and AWS S3.',
        version: '1.0.0',
        contact: {
          name: 'finsty Support',
          // email: 'support@finsty.dev',
        },
      },
      servers: [
        {
          url: '/',
          description: 'Current host (recommended for Try it out from /docs)',
        },
        {
          url: `http://localhost:${port}`,
          description: `localhost:${port}`,
        },
        {
          url: `http://127.0.0.1:${port}`,
          description: `127.0.0.1:${port}`,
        },
        {
          url: 'https://georgie-undenominated-muchly.ngrok-free.dev',
          description: 'Ngrok tunnel',
        },
      ],
      tags: [
        { name: 'Auth', description: 'Firebase-based authentication flows' },
        { name: 'User', description: 'User profile management' },
        { name: 'Addresses', description: 'User address management' },
        { name: 'Stores', description: 'Store discovery, search, and product browsing' },
        { name: 'Vendor dashboard', description: 'Vendor KPIs, revenue reports, sales analytics, and recent orders for the authenticated store' },
        { name: 'Cart', description: 'Shopping cart operations' },
        {
          name: 'Orders',
          description:
            'Order creation and management. Vendor lists: **GET /orders/vendor** (`status`, `from`, `to`, pagination). ' +
            'Live delivery tracking: **GET /orders/{orderId}/delivery-status** (Shadowfax).',
        },
        { name: 'Media', description: 'S3 presigned upload and file deletion' },
        { name: 'Products', description: 'Vendor product management — create, update, delete products and their SKU variants/images' },
        { name: 'Categories', description: 'Admin-managed product categories — used when creating or filtering products' },
        { name: 'Sub-Categories', description: 'Admin-managed sub-categories nested under a parent category — used when creating or filtering products' },
        { name: 'Wallet', description: 'User wallet — top-up, pay, refund, and transaction history' },
        { name: 'Payments', description: 'Razorpay payment initiation and capture flows' },
        { name: 'Payments — Admin', description: 'Admin-only: process wallet refund requests' },
        { name: 'OTP', description: 'Reusable OTP send/verify for phone and email — consumed by store creation and other flows' },
        { name: 'Shadowfax', description: 'Shadowfax logistics proxy APIs' },
        {
          name: 'Webhooks',
          description:
            'Inbound Shadowfax callbacks (`POST /api/webhooks/shadowfax`). No JWT — optional shared secret header.',
        },
        {
          name: 'Notifications',
          description:
            'In-app notification inbox (PostgreSQL). Each FCM push is also persisted for history and read state.\n\n' +
            '**Endpoints:** `GET /notifications` (paginated inbox), `GET /notifications/unread-count`, ' +
            '`PATCH /notifications/{notificationId}/read`, `PATCH /notifications/read-all`.\n\n' +
            'Inbox is scoped by JWT **role** (`user` / `vendor` / `admin`).\n\n' +
            '**Vendor category filter** on list/read-all: `orders` (new orders), `inventory` (stock alerts), `account` (login).',
        },
        { name: 'Health', description: 'Health and readiness checks' },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token obtained from /auth endpoints',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
    // staticCSP: true blocks Try it out (default-src 'self' has no connect-src; localhost ≠ 127.0.0.1).
    staticCSP: isProduction
      ? {
          'default-src': ["'self'"],
          'base-uri': ["'self'"],
          'font-src': ["'self'", 'https:', 'data:'],
          'img-src': ["'self'", 'data:', 'https:'],
          'object-src': ["'none'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https:'],
          'connect-src': ["'self'"],
        }
      : false,
    transformSpecificationClone: true,
  });
}

export default fp(swaggerPlugin, { name: 'swagger', fastify: '4.x' });
