import { FastifyInstance } from 'fastify';
import orderController, { ListOrdersQuery } from './order.controller';
import {
  createOrderSchema,
  getJobStatusSchema,
  listOrdersSchema,
  getOrderSchema,
  cancelOrderSchema,
  payWithWalletSchema,
  adminUpdateStatusSchema,
  vendorUpdateStatusSchema,
} from './order.schema';
import { Roles } from '@modules/user/user.model';

export default async function orderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  // POST /orders — enqueue order, returns 202
  fastify.post('/', { schema: createOrderSchema }, orderController.create.bind(orderController));

  // GET /orders/status/:jobId — poll processing result
  fastify.get(
    '/status/:jobId',
    { schema: getJobStatusSchema },
    orderController.getJobStatus.bind(orderController),
  );

  fastify.get('/', { schema: listOrdersSchema }, orderController.list.bind(orderController));

  fastify.get('/:orderId', { schema: getOrderSchema }, orderController.getOne.bind(orderController));

  fastify.patch('/:orderId/cancel', { schema: cancelOrderSchema }, orderController.cancel.bind(orderController));

  fastify.post('/:orderId/pay-wallet', { schema: payWithWalletSchema }, orderController.payWithWallet.bind(orderController));

  // Vendor routes
  fastify.get<{ Querystring: ListOrdersQuery }>(
    '/vendor',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: listOrdersSchema,
    },
    orderController.vendorList.bind(orderController),
  );

  fastify.patch<{ Params: { orderId: string }; Body: { status: string } }>(
    '/vendor/:orderId/status',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: vendorUpdateStatusSchema,
    },
    orderController.vendorUpdateStatus.bind(orderController),
  );
}

export async function adminOrderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  fastify.patch(
    '/:orderId/status',
    { schema: adminUpdateStatusSchema },
    orderController.adminUpdateStatus.bind(orderController),
  );
}
