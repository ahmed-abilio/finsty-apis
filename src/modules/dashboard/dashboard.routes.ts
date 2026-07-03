import { FastifyInstance } from 'fastify';
import { Roles } from '@modules/user/user.model';
import dashboardController, { type DashboardQuery } from './dashboard.controller';
import { getAdminDashboardSchema } from './dashboard.schema';

export default async function adminDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  fastify.get<{ Querystring: DashboardQuery }>(
    '/',
    { schema: getAdminDashboardSchema },
    dashboardController.getDashboard.bind(dashboardController),
  );
}
