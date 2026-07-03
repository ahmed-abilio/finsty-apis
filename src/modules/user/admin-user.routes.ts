import { FastifyInstance } from 'fastify';
import adminUserController from './admin-user.controller';
import { adminGetUserSchema, adminListUsersSchema } from './admin-user.schema';
import { Roles } from './user.model';
import type { AdminUserListFilters } from './user.service';

export async function adminUserRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  fastify.get<{ Querystring: AdminUserListFilters }>(
    '/',
    { schema: adminListUsersSchema },
    adminUserController.list.bind(adminUserController) as any,
  );

  fastify.get<{ Params: { userId: string } }>(
    '/:userId',
    { schema: adminGetUserSchema },
    adminUserController.getOne.bind(adminUserController) as any,
  );
}
