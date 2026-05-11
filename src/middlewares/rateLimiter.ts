import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import redis from '@config/redis';

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);

async function rateLimiterPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(rateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW_MS,
    redis: redis,
    keyGenerator: (request) => {
      // Use authenticated userId when available, otherwise fall back to IP
      const user = (request as { user?: { sub?: string } }).user;
      return user?.sub ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      },
    }),
  });
}

export default fp(rateLimiterPlugin, { name: 'rate-limiter', fastify: '4.x' });
