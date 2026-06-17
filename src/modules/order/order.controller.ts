import { FastifyRequest, FastifyReply } from 'fastify';
import { parseRevenueDateRange } from '@modules/store/vendorDashboard.utils';
import { AppError } from '@utils/appError';
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

export interface VendorListOrdersQuery extends ListOrdersQuery {
  from?: string;
  to?: string;
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
    request: FastifyRequest<{ Querystring: VendorListOrdersQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { from, to, status, page, limit } = request.query;
    let dateRange: ReturnType<typeof parseRevenueDateRange> | undefined;

    if (from !== undefined || to !== undefined) {
      if (!from || !to) {
        throw AppError.badRequest(
          'Both from and to are required when filtering by date',
          'INVALID_DATE_RANGE',
        );
      }
      try {
        dateRange = parseRevenueDateRange(from, to);
      } catch (err) {
        const code = (err as Error).message === 'INVALID_RANGE' ? 'INVALID_DATE_RANGE' : 'INVALID_DATE';
        const message =
          (err as Error).message === 'INVALID_RANGE'
            ? 'to must be greater than or equal to from'
            : 'from and to must be valid ISO timestamps';
        throw AppError.badRequest(message, code);
      }
    }

    const result = await orderService.listVendorOrders(
      request.user.sub,
      status as any,
      page,
      limit,
      dateRange,
    );
    void reply.status(200).send({ success: true, data: result });
  }

  async vendorGetOne(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const order = await orderService.getVendorOrderById(request.params.orderId, request.user.sub);
    void reply.status(200).send({ success: true, data: { order } });
  }

  async getOne(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const order = await orderService.getOrderById(request.params.orderId, request.user.sub);
    void reply.status(200).send({ success: true, data: { order } });
  }

  async getDeliveryStatus(
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = await orderService.getDeliveryStatus(
      request.params.orderId,
      request.user.sub,
      request.user.role,
    );
    void reply.status(200).send({ success: true, data });
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
