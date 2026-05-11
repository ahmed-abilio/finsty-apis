import { FastifyRequest, FastifyReply } from 'fastify';
import paymentService, { InitiatePaymentInput, CapturePaymentInput } from './payment.service';
import { Roles } from '@modules/user/user.model';

interface PaymentParams {
  paymentId: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

class PaymentController {
  async initiatePayment(
    request: FastifyRequest<{ Body: InitiatePaymentInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await paymentService.initiatePayment(request.user.sub, request.body);
    void reply.status(200).send({ success: true, data: result });
  }

  async capturePayment(
    request: FastifyRequest<{ Body: CapturePaymentInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await paymentService.capturePayment(request.user.sub, request.body);
    void reply.status(200).send({ success: true, data: result });
  }

  async requestRefund(
    request: FastifyRequest<{ Params: PaymentParams; Body: { reason?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await paymentService.requestRefund(request.user.sub, {
      paymentId: request.params.paymentId,
      reason: request.body.reason,
    });
    void reply.status(200).send({ success: true, data: result });
  }

  async getPayment(
    request: FastifyRequest<{ Params: PaymentParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const isAdmin = request.user.role === Roles.ADMIN;
    const payment = await paymentService.getPayment(
      request.user.sub,
      request.params.paymentId,
      isAdmin,
    );
    void reply.status(200).send({ success: true, data: { payment } });
  }

  async processRefund(
    request: FastifyRequest<{ Params: PaymentParams; Body: { note?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    await paymentService.processRefund(request.user.sub, {
      paymentId: request.params.paymentId,
      note: request.body.note,
    });
    void reply.status(200).send({ success: true, data: { message: 'Refund processed successfully' } });
  }

  async listRefundRequests(
    request: FastifyRequest<{ Querystring: PaginationQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { page = 1, limit = 20 } = request.query;
    const result = await paymentService.listRefundRequests(page, limit);
    void reply.status(200).send({ success: true, data: result });
  }

  async getPaymentConfig(
    _request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await paymentService.getPaymentConfig();
    void reply.status(200).send({ success: true, data: result });
  }
}

export default new PaymentController();
