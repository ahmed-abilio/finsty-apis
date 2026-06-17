import { FastifyInstance } from 'fastify';
import configController from './config.controller';
import { getDeliveryConfigSchema } from './config.schema';

export default async function configRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/delivery',
    { schema: getDeliveryConfigSchema },
    (request, reply) => configController.getDeliveryConfig(request, reply),
  );
}
