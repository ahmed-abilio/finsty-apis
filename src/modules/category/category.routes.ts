import { FastifyInstance } from 'fastify';
import categoryController from './category.controller';
import {
  createCategorySchema,
  listCategoriesSchema,
  getCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from './category.schema';
import { Roles } from '@modules/user/user.model';

export default async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Admin-only write routes ─────────────────────────────────────────────────

  fastify.post(
    '/',
    {
      schema: createCategorySchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => categoryController.create(request as any, reply),
  );

  fastify.patch(
    '/:categoryId',
    {
      schema: updateCategorySchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => categoryController.update(request as any, reply),
  );

  fastify.delete(
    '/:categoryId',
    {
      schema: deleteCategorySchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => categoryController.remove(request as any, reply),
  );

  // ── Public read routes ──────────────────────────────────────────────────────

  fastify.get(
    '/',
    { schema: listCategoriesSchema },
    (request, reply) => categoryController.list(request as any, reply),
  );

  fastify.get(
    '/:categoryId',
    { schema: getCategorySchema },
    (request, reply) => categoryController.getOne(request as any, reply),
  );
}
