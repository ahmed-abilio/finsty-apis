import { FastifyRequest, FastifyReply } from 'fastify';
import paymentService from './payment.service';
import type { PaymentStatus } from './payment.model';

export interface AdminListPaymentsQuery {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  userId?: string;
  orderId?: string;
  email?: string;
  provider?: string;
  from?: string;
  to?: string;
}

class AdminPaymentController {
  async list(
    request: FastifyRequest<{ Querystring: AdminListPaymentsQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await paymentService.listForAdmin(request.query);
    void reply.status(200).send({ success: true, data: result });
  }

  async getSummary(
    request: FastifyRequest<{ Querystring: { from?: string; to?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = await paymentService.getAdminPaymentsSummary({
      from: request.query.from,
      to: request.query.to,
    });
    void reply.status(200).send({ success: true, data });
  }

  async getOne(
    request: FastifyRequest<{ Params: { paymentId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const payment = await paymentService.getByIdForAdmin(request.params.paymentId);
    void reply.status(200).send({ success: true, data: { payment } });
  }
}

export default new AdminPaymentController();
