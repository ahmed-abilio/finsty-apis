import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

async function helmetPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(helmet, {
    // Allow Swagger UI's inline scripts/styles in development
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  });
}

export default fp(helmetPlugin, { name: 'helmet', fastify: '4.x' });
