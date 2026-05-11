import { FastifyInstance } from 'fastify';
import paymentController from './payment.controller';
import {
  initiatePaymentSchema,
  capturePaymentSchema,
  requestRefundSchema,
  getPaymentSchema,
  processRefundSchema,
  listRefundRequestsSchema,
  getPaymentConfigSchema,
} from './payment.schema';
import { Roles } from '@modules/user/user.model';

export default async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require JWT
  fastify.addHook('onRequest', fastify.authenticate);

  // ── User routes ─────────────────────────────────────────────────────────────

  fastify.post(
    '/initiate',
    { schema: initiatePaymentSchema },
    (request, reply) => paymentController.initiatePayment(request as any, reply),
  );

  fastify.post(
    '/capture',
    { schema: capturePaymentSchema },
    (request, reply) => paymentController.capturePayment(request as any, reply),
  );

  fastify.post(
    '/:paymentId/refund-request',
    { schema: requestRefundSchema },
    (request, reply) => paymentController.requestRefund(request as any, reply),
  );

  fastify.get(
    '/:paymentId',
    { schema: getPaymentSchema },
    (request, reply) => paymentController.getPayment(request as any, reply),
  );

  fastify.get(
    '/config',
    { schema: getPaymentConfigSchema },
    (request, reply) => paymentController.getPaymentConfig(request as any, reply),
  );

  // ── Admin routes ────────────────────────────────────────────────────────────

  fastify.post(
    '/admin/:paymentId/process-refund',
    {
      schema: processRefundSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => paymentController.processRefund(request as any, reply),
  );

  fastify.get(
    '/admin/refund-requests',
    {
      schema: listRefundRequestsSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => paymentController.listRefundRequests(request as any, reply),
  );
}
