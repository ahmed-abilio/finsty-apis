import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '@modules/auth/auth.service';
import userService from '@modules/user/user.service';
import { AppError } from '@utils/appError';
import type { JwtPayload } from '@types-app/index';
import { Roles } from '@modules/user/user.model';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: Roles[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Registers `fastify.authenticate` — a preHandler that validates the
 * Bearer JWT and populates `request.user` with the decoded payload.
 *
 * Usage in a route:
 *   { onRequest: [fastify.authenticate] }
 *   OR as a route-level hook via fastify.addHook('onRequest', fastify.authenticate)
 */
async function authenticatePlugin(fastify: FastifyInstance): Promise<void> {
  async function assertAuthenticatedUser(payload: JwtPayload): Promise<JwtPayload> {
    await userService.findByIdForRole(payload.sub, { role: payload.role as Roles });
    return payload;
  }

  fastify.decorate(
    'authenticate',
    async function authenticate(
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw AppError.unauthorized('Missing or malformed Authorization header', 'MISSING_TOKEN');
      }
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);
      request.user = await assertAuthenticatedUser(payload);
    },
  );

  fastify.decorate(
    'optionalAuthenticate',
    async function optionalAuthenticate(
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return;
      try {
        const payload = verifyAccessToken(authHeader.slice(7));
        request.user = await assertAuthenticatedUser(payload);
      } catch {
        // invalid token — treat as unauthenticated
      }
    },
  );

  fastify.decorate(
    'requireRole',
    function requireRole(...roles: Roles[]) {
      return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
        if (!roles.includes(request.user?.role as Roles)) {
          throw AppError.forbidden('You do not have permission to access this resource', 'FORBIDDEN');
        }
      };
    },
  );
}

export default fp(authenticatePlugin, {
  name: 'authenticate',
  fastify: '4.x',
});
