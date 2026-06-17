import { FastifyInstance } from 'fastify';
import shadowfaxController from './shadowfax.controller';
import { checkOrderServiceabilitySchema } from './shadowfax.schema';

export default async function shadowfaxRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.put(
    '/order-serviceability',
    { schema: checkOrderServiceabilitySchema },
    shadowfaxController.checkOrderServiceability.bind(shadowfaxController),
  );
}
