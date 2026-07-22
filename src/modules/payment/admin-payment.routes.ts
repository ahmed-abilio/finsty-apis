import { FastifyInstance } from 'fastify';
import adminPaymentController, {
  type AdminListPaymentsQuery,
} from './admin-payment.controller';
import {
  adminGetPaymentSchema,
  adminListPaymentsSchema,
  adminPaymentsSummarySchema,
} from './payment.schema';
import { Roles } from '@modules/user/user.model';

export async function adminPaymentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  fastify.get<{ Querystring: AdminListPaymentsQuery }>(
    '/',
    { schema: adminListPaymentsSchema },
    adminPaymentController.list.bind(adminPaymentController) as any,
  );

  // Must be registered before /:paymentId
  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    '/summary',
    { schema: adminPaymentsSummarySchema },
    adminPaymentController.getSummary.bind(adminPaymentController) as any,
  );

  fastify.get<{ Params: { paymentId: string } }>(
    '/:paymentId',
    { schema: adminGetPaymentSchema },
    adminPaymentController.getOne.bind(adminPaymentController) as any,
  );
}
