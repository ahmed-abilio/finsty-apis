import { FastifyInstance } from 'fastify';
import walletController from './wallet.controller';
import {
  getWalletSchema,
  listTransactionsSchema,
  getTransactionSchema,
  initiateTopupSchema,
  verifyTopupSchema,
  paySchema,
  refundSchema,
} from './wallet.schema';
import { Roles } from '@modules/user/user.model';

export default async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get(
    '/',
    { schema: getWalletSchema },
    (request, reply) => walletController.getWallet(request as any, reply),
  );

  fastify.get(
    '/transactions',
    { schema: listTransactionsSchema },
    (request, reply) => walletController.listTransactions(request as any, reply),
  );

  fastify.get(
    '/transactions/:reference',
    { schema: getTransactionSchema },
    (request, reply) => walletController.getTransaction(request as any, reply),
  );

  fastify.post(
    '/topup/initiate',
    { schema: initiateTopupSchema },
    (request, reply) => walletController.initiateTopup(request as any, reply),
  );

  fastify.post(
    '/topup/verify',
    { schema: verifyTopupSchema },
    (request, reply) => walletController.verifyTopup(request as any, reply),
  );

  fastify.post(
    '/pay',
    { schema: paySchema },
    (request, reply) => walletController.pay(request as any, reply),
  );

  fastify.post(
    '/refund',
    {
      schema: refundSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => walletController.refund(request as any, reply),
  );
}
