import { FastifyInstance } from 'fastify';
import reviewController from './review.controller';
import {
  submitReviewSchema,
  listProductReviewsSchema,
  flagReviewSchema,
  adminListReviewsSchema,
  respondToReviewSchema,
  setReviewStatusSchema,
} from './review.schema';
import { Roles } from '@modules/user/user.model';

/**
 * User-facing review routes — mounted at /api/v1/products and /api/v1/reviews.
 *
 *   POST   /products/:productId/reviews  — submit a review (auth required)
 *   GET    /products/:productId/reviews  — list approved reviews (public)
 *   POST   /reviews/:reviewId/flag       — flag a review (auth required)
 *
 * Register this plugin TWICE:
 *   1. prefix `/api/v1/products`   → product-scoped routes
 *   2. prefix `/api/v1/reviews`    → flat review routes (flag)
 */
export async function productReviewRoutes(fastify: FastifyInstance): Promise<void> {
  // GET is public; POST requires auth — handle per route.

  // Public: list reviews for a product
  fastify.get(
    '/:productId/reviews',
    { schema: listProductReviewsSchema },
    (request, reply) => reviewController.listForProduct(request as any, reply),
  );

  // Auth required: submit a review
  fastify.post(
    '/:productId/reviews',
    {
      schema: submitReviewSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => reviewController.submit(request as any, reply),
  );
}

/**
 * Flat review actions — mounted at /api/v1/reviews.
 */
export async function reviewActionRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth required: flag a review
  fastify.post(
    '/:reviewId/flag',
    {
      schema: flagReviewSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => reviewController.flag(request as any, reply),
  );
}

/**
 * Admin moderation routes — mounted at /api/v1/admin/reviews.
 * All routes require ADMIN role.
 */
export async function adminReviewRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireRole(Roles.ADMIN));

  fastify.get(
    '/',
    { schema: adminListReviewsSchema },
    (request, reply) => reviewController.adminList(request as any, reply),
  );

  fastify.patch(
    '/:reviewId/respond',
    { schema: respondToReviewSchema },
    (request, reply) => reviewController.respond(request as any, reply),
  );

  fastify.patch(
    '/:reviewId/status',
    { schema: setReviewStatusSchema },
    (request, reply) => reviewController.setStatus(request as any, reply),
  );
}
