import { FastifyInstance } from 'fastify';
import productController from './product.controller';
import {
  listProductsSchema,
  listBrandsSchema,
  listDraftsSchema,
  createProductSchema,
  getProductSchema,
  updateProductSchema,
  fullUpdateProductSchema,
  deleteProductSchema,
  publishProductSchema,
  addImageSchema,
  deleteImageSchema,
  addColorSchema,
  updateColorSchema,
  deleteColorSchema,
  addColorImageSchema,
  deleteColorImageSchema,
  addVariantSchema,
  updateVariantSchema,
  deleteVariantSchema,
  getProductBySlugSchema,
} from './product.schema';
import { Roles } from '@modules/user/user.model';

/**
 * Authorization strategy:
 *  - All routes require a valid JWT (`fastify.authenticate`).
 *  - Write routes (create/update/delete) are restricted to `vendor` and `admin` roles.
 *  - Cross-vendor isolation is enforced in `productService` by comparing
 *    `store.ownerId` with `request.user.sub` — never trust client input for this.
 *  - Admins bypass the ownership check and can manage any product.
 *
 * Route hierarchy (3-tier):
 *   Product → Colors → Variants (SKUs)
 *                    → Images
 */
export default async function productRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Public listing (no auth required) ───────────────────────────────────────

  // Must be registered before /:productId to avoid param capture
  fastify.get(
    '/brands',
    {
      schema: listBrandsSchema,
      onRequest: [fastify.authenticate],
    },
    (request, reply) => productController.listBrands(request as any, reply),
  );

  fastify.get(
    '/',
    {
      schema: listProductsSchema,
      onRequest: [fastify.optionalAuthenticate],
    },
    (request, reply) => productController.list(request as any, reply),
  );

  // Slug-based lookup (must be before /:productId)
  fastify.get(
    '/slug/:slug',
    { schema: getProductBySlugSchema },
    (request, reply) => productController.getBySlug(request as any, reply),
  );

  // Vendor/admin draft listing (must be before /:productId)
  fastify.get(
    '/drafts',
    {
      schema: listDraftsSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.listDrafts(request as any, reply),
  );

  // ── Product CRUD ────────────────────────────────────────────────────────────

  fastify.post(
    '/',
    {
      schema: createProductSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.create(request as any, reply),
  );

  fastify.get(
    '/:productId',
    { schema: getProductSchema, onRequest: [fastify.optionalAuthenticate] },
    (request, reply) => productController.getOne(request as any, reply),
  );

  // Publish route must be before PATCH /:productId to avoid ambiguity
  fastify.patch(
    '/:productId/publish',
    {
      schema: publishProductSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.publish(request as any, reply),
  );

  fastify.patch(
    '/:productId',
    {
      schema: updateProductSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.update(request as any, reply),
  );

  fastify.put(
    '/:productId',
    {
      schema: fullUpdateProductSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.fullUpdate(request as any, reply),
  );

  fastify.delete(
    '/:productId',
    {
      schema: deleteProductSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.remove(request as any, reply),
  );

  // ── Product-level images ────────────────────────────────────────────────────

  fastify.post(
    '/:productId/images',
    {
      schema: addImageSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.addImage(request as any, reply),
  );

  fastify.delete(
    '/:productId/images/:imageId',
    {
      schema: deleteImageSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.removeImage(request as any, reply),
  );

  // ── Colour management ───────────────────────────────────────────────────────

  fastify.post(
    '/:productId/colors',
    {
      schema: addColorSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.addColor(request as any, reply),
  );

  fastify.patch(
    '/:productId/colors/:colorId',
    {
      schema: updateColorSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.updateColor(request as any, reply),
  );

  fastify.delete(
    '/:productId/colors/:colorId',
    {
      schema: deleteColorSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.removeColor(request as any, reply),
  );

  // ── Colour image management ─────────────────────────────────────────────────

  fastify.post(
    '/:productId/colors/:colorId/images',
    {
      schema: addColorImageSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.addColorImage(request as any, reply),
  );

  fastify.delete(
    '/:productId/colors/:colorId/images/:imageId',
    {
      schema: deleteColorImageSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.removeColorImage(request as any, reply),
  );

  // ── Variant (SKU) management ────────────────────────────────────────────────

  fastify.post(
    '/:productId/colors/:colorId/variants',
    {
      schema: addVariantSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.addVariant(request as any, reply),
  );

  fastify.patch(
    '/:productId/colors/:colorId/variants/:variantId',
    {
      schema: updateVariantSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.updateVariant(request as any, reply),
  );

  fastify.delete(
    '/:productId/colors/:colorId/variants/:variantId',
    {
      schema: deleteVariantSchema,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    (request, reply) => productController.removeVariant(request as any, reply),
  );
}
