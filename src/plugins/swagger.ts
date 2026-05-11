import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';

async function swaggerPlugin(fastify: FastifyInstance): Promise<void> {
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
          url: `http://localhost:${process.env.PORT ?? 3000}`,
          description: 'Local development',
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
        { name: 'Cart', description: 'Shopping cart operations' },
        { name: 'Orders', description: 'Order creation and management' },
        { name: 'Media', description: 'S3 presigned upload and file deletion' },
        { name: 'Products', description: 'Vendor product management — create, update, delete products and their SKU variants/images' },
        { name: 'Categories', description: 'Admin-managed product categories — used when creating or filtering products' },
        { name: 'Sub-Categories', description: 'Admin-managed sub-categories nested under a parent category — used when creating or filtering products' },
        { name: 'Wallet', description: 'User wallet — top-up, pay, refund, and transaction history' },
        { name: 'Payments', description: 'Razorpay payment initiation and capture flows' },
        { name: 'Payments — Admin', description: 'Admin-only: process wallet refund requests' },
        { name: 'OTP', description: 'Reusable OTP send/verify for phone and email — consumed by store creation and other flows' },
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
    staticCSP: true,
    transformSpecificationClone: true,
  });
}

export default fp(swaggerPlugin, { name: 'swagger', fastify: '4.x' });
