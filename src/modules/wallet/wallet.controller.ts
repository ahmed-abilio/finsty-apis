import { FastifyRequest, FastifyReply } from 'fastify';
import walletService, {
  TopupInitiateInput,
  TopupVerifyInput,
  PayInput,
  RefundInput,
  ListTransactionsQuery,
} from './wallet.service';

interface TransactionParams {
  reference: string;
}

class WalletController {
  async getWallet(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const wallet = await walletService.getWallet(request.user.sub);
    void reply.status(200).send({ success: true, data: { wallet: wallet.toPublicJSON() } });
  }

  async listTransactions(
    request: FastifyRequest<{ Querystring: ListTransactionsQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await walletService.listTransactions(request.user.sub, request.query);
    void reply.status(200).send({ success: true, data: result });
  }

  async getTransaction(
    request: FastifyRequest<{ Params: TransactionParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const tx = await walletService.getTransaction(request.user.sub, request.params.reference);
    void reply.status(200).send({ success: true, data: { transaction: tx } });
  }

  async initiateTopup(
    request: FastifyRequest<{ Body: TopupInitiateInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await walletService.initiateTopup(request.user.sub, request.body);
    void reply.status(200).send({ success: true, data: result });
  }

  async verifyTopup(
    request: FastifyRequest<{ Body: TopupVerifyInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const tx = await walletService.verifyTopup(request.user.sub, request.body);
    void reply.status(200).send({ success: true, data: { transaction: tx } });
  }

  async pay(
    request: FastifyRequest<{ Body: PayInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const tx = await walletService.pay(request.user.sub, request.body);
    void reply.status(200).send({ success: true, data: { transaction: tx } });
  }

  async refund(
    request: FastifyRequest<{ Body: Omit<RefundInput, 'userId'> & { userId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const tx = await walletService.refund(request.body);
    void reply.status(200).send({ success: true, data: { transaction: tx } });
  }
}

export default new WalletController();
