import { FastifyInstance } from 'fastify';
import storeReviewController from './store-review.controller';
import {
  submitStoreReviewSchema,
  listStoreReviewsSchema,
  respondToStoreReviewSchema,
  adminListStoreReviewsSchema,
  setStoreReviewStatusSchema,
} from './store-review.schema';
import { Roles } from '@modules/user/user.model';

/**
 * Customer-facing store review routes — mounted at /api/v1/stores.
 *
 *   GET   /:storeId/reviews                      — list approved reviews (public)
 *   POST  /:storeId/reviews                      — submit a review (auth required)
 *   PATCH /:storeId/reviews/:reviewId/respond    — vendor / admin reply (vendor or admin role)
 */
export async function storeReviewRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/:storeId/reviews',
    { schema: listStoreReviewsSchema },
    (request, reply) => storeReviewController.listForStore(request as any, reply),
  );

  fastify.post(
    '/:storeId/reviews',
    {
      schema: submitStoreReviewSchema,
      onRequest: [fastify.authenticate],
    },
    (request, reply) => storeReviewController.submit(request as any, reply),
  );

  fastify.patch(
    '/:storeId/reviews/:reviewId/respond',
    {
      schema: respondToStoreReviewSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => storeReviewController.respond(request as any, reply),
  );
}

/**
 * Admin store review moderation routes — mounted at /api/v1/admin/store-reviews.
 * All routes require ADMIN role.
 */
export async function adminStoreReviewRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireRole(Roles.ADMIN));

  fastify.get(
    '/',
    { schema: adminListStoreReviewsSchema },
    (request, reply) => storeReviewController.adminList(request as any, reply),
  );

  fastify.patch(
    '/:reviewId/status',
    { schema: setStoreReviewStatusSchema },
    (request, reply) => storeReviewController.setStatus(request as any, reply),
  );
}
