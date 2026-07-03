import { FastifyRequest, FastifyReply } from 'fastify';
import orderReturnService, { CreateReturnInput } from './orderReturn.service';
import { getOrderReturnDeliveryStatus } from './orderReturnDeliveryStatus.service';

interface OrderReturnParams {
  orderId: string;
  returnId?: string;
}

interface VendorReturnParams {
  returnId: string;
}

interface ListVendorReturnsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

interface RejectReturnBody {
  reason?: string;
}

class OrderReturnController {
  async create(
    request: FastifyRequest<{ Params: OrderReturnParams; Body: CreateReturnInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const orderReturn = await orderReturnService.createReturn(
      request.params.orderId,
      request.user.sub,
      request.body,
    );
    void reply.status(201).send({ success: true, data: { return: orderReturn } });
  }

  async list(
    request: FastifyRequest<{ Params: OrderReturnParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const returns = await orderReturnService.listReturnsForOrder(
      request.params.orderId,
      request.user.sub,
      request.user.role,
    );
    void reply.status(200).send({ success: true, data: { returns } });
  }

  async getOne(
    request: FastifyRequest<{ Params: OrderReturnParams & { returnId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const orderReturn = await orderReturnService.getReturn(
      request.params.orderId,
      request.params.returnId,
      request.user.sub,
      request.user.role,
    );
    void reply.status(200).send({ success: true, data: { return: orderReturn } });
  }

  async getDeliveryStatus(
    request: FastifyRequest<{ Params: OrderReturnParams & { returnId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = await getOrderReturnDeliveryStatus(
      request.params.orderId,
      request.params.returnId,
      { userId: request.user.sub, role: request.user.role },
    );
    void reply.status(200).send({ success: true, data });
  }

  async vendorList(
    request: FastifyRequest<{ Querystring: ListVendorReturnsQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await orderReturnService.listVendorReturns(
      request.user.sub,
      request.query.status,
      request.query.page,
      request.query.limit,
    );
    void reply.status(200).send({ success: true, data: result });
  }

  async vendorApprove(
    request: FastifyRequest<{ Params: VendorReturnParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const orderReturn = await orderReturnService.approveReturn(
      request.params.returnId,
      request.user.sub,
    );
    void reply.status(200).send({ success: true, data: { return: orderReturn } });
  }

  async vendorReject(
    request: FastifyRequest<{ Params: VendorReturnParams; Body: RejectReturnBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const orderReturn = await orderReturnService.rejectReturn(
      request.params.returnId,
      request.user.sub,
      request.body?.reason,
    );
    void reply.status(200).send({ success: true, data: { return: orderReturn } });
  }
}

export default new OrderReturnController();
