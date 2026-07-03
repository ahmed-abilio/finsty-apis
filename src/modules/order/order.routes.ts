import { FastifyInstance } from 'fastify';
import orderController, { AdminListOrdersQuery, VendorListOrdersQuery } from './order.controller';
import orderReturnController from './orderReturn.controller';
import {
  createOrderSchema,
  getJobStatusSchema,
  listOrdersSchema,
  listVendorOrdersSchema,
  getOrderSchema,
  getOrderDeliveryStatusSchema,
  cancelOrderSchema,
  payWithWalletSchema,
  adminUpdateStatusSchema,
  adminListOrdersSchema,
  adminGetOrderSchema,
  vendorGetOrderSchema,
  vendorDispatchReadySchema,
  vendorUpdateStatusSchema,
} from './order.schema';
import {
  createOrderReturnSchema,
  listOrderReturnsSchema,
  getOrderReturnSchema,
  getOrderReturnDeliveryStatusSchema,
  listVendorReturnsSchema,
  approveVendorReturnSchema,
  rejectVendorReturnSchema,
} from './orderReturn.schema';
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

  // Vendor routes (register before /:orderId so /vendor is not captured as orderId)
  fastify.get<{ Querystring: VendorListOrdersQuery }>(
    '/vendor',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: listVendorOrdersSchema,
    },
    orderController.vendorList.bind(orderController),
  );

  fastify.get<{ Params: { orderId: string } }>(
    '/vendor/:orderId',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: vendorGetOrderSchema,
    },
    orderController.vendorGetOne.bind(orderController),
  );

  fastify.patch<{ Params: { orderId: string }; Body: { status: string } }>(
    '/vendor/:orderId/status',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: vendorUpdateStatusSchema,
    },
    orderController.vendorUpdateStatus.bind(orderController),
  );

  fastify.put<{ Params: { orderId: string }; Body: { shipment_ready_timestamp: string } }>(
    '/vendor/:orderId/dispatch-ready',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: vendorDispatchReadySchema,
    },
    orderController.vendorDispatchReady.bind(orderController),
  );

  fastify.get<{ Querystring: { status?: string; page?: number; limit?: number } }>(
    '/vendor/returns',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: listVendorReturnsSchema,
    },
    orderReturnController.vendorList.bind(orderReturnController),
  );

  fastify.post<{ Params: { returnId: string } }>(
    '/vendor/returns/:returnId/approve',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: approveVendorReturnSchema,
    },
    orderReturnController.vendorApprove.bind(orderReturnController),
  );

  fastify.post<{ Params: { returnId: string }; Body: { reason?: string } }>(
    '/vendor/returns/:returnId/reject',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
      schema: rejectVendorReturnSchema,
    },
    orderReturnController.vendorReject.bind(orderReturnController),
  );

  fastify.post(
    '/:orderId/returns',
    { schema: createOrderReturnSchema },
    orderReturnController.create.bind(orderReturnController),
  );

  fastify.get(
    '/:orderId/returns',
    { schema: listOrderReturnsSchema },
    orderReturnController.list.bind(orderReturnController),
  );

  fastify.get(
    '/:orderId/returns/:returnId/delivery-status',
    { schema: getOrderReturnDeliveryStatusSchema },
    orderReturnController.getDeliveryStatus.bind(orderReturnController),
  );

  fastify.get(
    '/:orderId/returns/:returnId',
    { schema: getOrderReturnSchema },
    orderReturnController.getOne.bind(orderReturnController),
  );

  fastify.get(
    '/:orderId/delivery-status',
    { schema: getOrderDeliveryStatusSchema },
    orderController.getDeliveryStatus.bind(orderController),
  );

  fastify.get('/:orderId', { schema: getOrderSchema }, orderController.getOne.bind(orderController));

  fastify.patch('/:orderId/cancel', { schema: cancelOrderSchema }, orderController.cancel.bind(orderController));

  fastify.post('/:orderId/pay-wallet', { schema: payWithWalletSchema }, orderController.payWithWallet.bind(orderController));
}

export async function adminOrderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  fastify.get<{ Querystring: AdminListOrdersQuery }>(
    '/',
    { schema: adminListOrdersSchema },
    orderController.adminList.bind(orderController) as any,
  );

  fastify.get<{ Params: { orderId: string } }>(
    '/:orderId',
    { schema: adminGetOrderSchema },
    orderController.adminGetOne.bind(orderController) as any,
  );

  fastify.patch(
    '/:orderId/status',
    { schema: adminUpdateStatusSchema },
    orderController.adminUpdateStatus.bind(orderController),
  );
}
