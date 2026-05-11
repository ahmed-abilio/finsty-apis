import { FastifyInstance } from 'fastify';
import subCategoryController from './sub-category.controller';
import {
  createSubCategorySchema,
  listSubCategoriesSchema,
  getSubCategorySchema,
  updateSubCategorySchema,
  deleteSubCategorySchema,
} from './sub-category.schema';
import { Roles } from '@modules/user/user.model';

/**
 * Two route groups are registered here:
 *
 *   Nested under /api/v1/categories/:categoryId/sub-categories
 *     POST   /                  — create (admin only)
 *     GET    /                  — list by parent category (public)
 *
 *   Flat under /api/v1/sub-categories
 *     GET    /:subCategoryId    — get by id (public)
 *     PATCH  /:subCategoryId    — update (admin only)
 *     DELETE /:subCategoryId    — delete (admin only)
 *
 * Both sets are registered via a single Fastify plugin because app.ts mounts
 * this plugin twice — once at each prefix — see app.ts for details.
 * Instead we use a `routePrefix` option pattern: app.ts registers this plugin
 * once and the routes self-define their full paths.
 */
export async function subCategoryNestedRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/categories/:categoryId/sub-categories
  fastify.post(
    '/:categoryId/sub-categories',
    {
      schema: createSubCategorySchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => subCategoryController.create(request as any, reply),
  );

  // GET /api/v1/categories/:categoryId/sub-categories
  fastify.get(
    '/:categoryId/sub-categories',
    { schema: listSubCategoriesSchema },
    (request, reply) => subCategoryController.listByCategory(request as any, reply),
  );
}

export async function subCategoryFlatRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/sub-categories/:subCategoryId
  fastify.get(
    '/:subCategoryId',
    { schema: getSubCategorySchema },
    (request, reply) => subCategoryController.getOne(request as any, reply),
  );

  // PATCH /api/v1/sub-categories/:subCategoryId
  fastify.patch(
    '/:subCategoryId',
    {
      schema: updateSubCategorySchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => subCategoryController.update(request as any, reply),
  );

  // DELETE /api/v1/sub-categories/:subCategoryId
  fastify.delete(
    '/:subCategoryId',
    {
      schema: deleteSubCategorySchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => subCategoryController.remove(request as any, reply),
  );
}
