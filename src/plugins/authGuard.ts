import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@utils/appError';

declare module 'fastify' {
  interface FastifyInstance {
    adminGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Admin API key guard — used to protect Bull Board and other admin routes.
 * Checks for `x-admin-api-key` header against ADMIN_API_KEY env var.
 */
async function authGuardPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate(
    'adminGuard',
    async function adminGuard(
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> {
      const adminKey = process.env.ADMIN_API_KEY;
      if (!adminKey) {
        throw AppError.internal('ADMIN_API_KEY is not configured');
      }

      const provided = request.headers['x-admin-api-key'];
      if (!provided || provided !== adminKey) {
        throw AppError.unauthorized('Invalid or missing admin API key', 'INVALID_ADMIN_KEY');
      }
    },
  );
}

export default fp(authGuardPlugin, { name: 'auth-guard', fastify: '4.x' });
