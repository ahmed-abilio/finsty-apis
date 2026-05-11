import { FastifyRequest, FastifyReply } from 'fastify';
import orderService, { CreateOrderInput } from './order.service';

interface OrderParams {
  orderId: string;
}

interface JobParams {
  jobId: string;
}

export interface ListOrdersQuery {
  page?: number;
  limit?: number;
  status?: string;
}

interface UpdateStatusBody {
  status: string;
}

class OrderController {
  async create(
    request: FastifyRequest<{ Body: CreateOrderInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await orderService.createFromCart(request.user.sub, request.body);
    void reply.status(202).send({ success: true, data: result });
  }

  async getJobStatus(
    request: FastifyRequest<{ Params: JobParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const status = await orderService.getJobStatus(request.params.jobId, request.user.sub);
    void reply.status(200).send({ success: true, data: { job: status } });
  }

  async list(
    request: FastifyRequest<{ Querystring: ListOrdersQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await orderService.listOrders(
      request.user.sub,
      request.query.status as any,
      request.query.page,
      request.query.limit,
    );
    void reply.status(200).send({ success: true, data: result });
  }

  async vendorList(
    request: FastifyRequest<{ Querystring: ListOrdersQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await orderService.listVendorOrders(
      request.user.sub,
      request.query.page,
      request.query.limit,
    );
    void reply.status(200).send({ success: true, data: result });
  }

  async getOne(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const order = await orderService.getOrderById(request.params.orderId, request.user.sub);
    void reply.status(200).send({ success: true, data: { order } });
  }

  async cancel(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const order = await orderService.cancelOrder(request.params.orderId, request.user.sub);
    void reply.status(200).send({ success: true, data: { order } });
  }

  async payWithWallet(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await orderService.payWithWallet(request.params.orderId, request.user.sub);
    void reply.status(200).send({ success: true, data: result });
  }

  async adminUpdateStatus(
    request: FastifyRequest<{ Params: OrderParams; Body: UpdateStatusBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const order = await orderService.updateStatus(request.params.orderId, request.body.status);
    void reply.status(200).send({ success: true, data: { order } });
  }

  async vendorUpdateStatus(
    request: FastifyRequest<{ Params: OrderParams; Body: UpdateStatusBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const order = await orderService.updateVendorOrderStatus(
      request.params.orderId,
      request.user.sub,
      request.body.status,
    );
    void reply.status(200).send({ success: true, data: { order } });
  }
}

export default new OrderController();
