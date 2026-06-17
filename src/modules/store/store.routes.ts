import { FastifyInstance } from 'fastify';
import storeController from './store.controller';
import {
  listStoresSchema,
  listStoreCategoryExplorerSchema,
  getStoreSchema,
  getStoreCategoriesSchema,
  getStoreAttributesSchema,
  listStoreProductsSchema,
  getProductSchema,
  createStoreSchema,
  approveVendorSchema,
  updateStoreSchema,
  deleteStoreSchema,
  toggleActiveSchema,
  getMyStoreSchema,
  getMyBrandsSchema,
  updateMyBrandsSchema,
  getMyProductsSchema,
  getMyDashboardSchema,
  getMyRevenueSchema,
  getStoreBySlugSchema,
} from './store.schema';
import { Roles } from '@modules/user/user.model';

export default async function storeRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── Public / user-accessible reads ─────────────────────────────────────────
  fastify.get('/', { schema: listStoresSchema }, storeController.list.bind(storeController));

  // ─── Slug-based lookup (must be before /:storeId) ─────────────────────────
  fastify.get('/slug/:slug', { schema: getStoreBySlugSchema }, storeController.getBySlug.bind(storeController));

  // ─── Vendor-only: own store management (must be before /:storeId) ────────────
  fastify.get(
    '/my',
    {
      schema: getMyStoreSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    storeController.getMyStore.bind(storeController) as any,
  );

  fastify.get(
    '/my/products',
    {
      schema: getMyProductsSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    storeController.getMyProducts.bind(storeController) as any,
  );

  fastify.get(
    '/my/dashboard',
    {
      schema: getMyDashboardSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    storeController.getMyDashboard.bind(storeController) as any,
  );

  fastify.get(
    '/my/revenue',
    {
      schema: getMyRevenueSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    storeController.getMyRevenue.bind(storeController) as any,
  );

  fastify.get(
    '/my/brands',
    {
      schema: getMyBrandsSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    storeController.getMyBrands.bind(storeController) as any,
  );

  fastify.patch(
    '/my/brands',
    {
      schema: updateMyBrandsSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    storeController.updateMyBrands.bind(storeController) as any,
  );

  // ─── Public: category explorer (must be before /:storeId) ───────────────────
  fastify.get('/categories/explorer', { schema: listStoreCategoryExplorerSchema }, storeController.exploreCategoryExplorer.bind(storeController));
  fastify.get('/categories', { schema: listStoreCategoryExplorerSchema }, storeController.exploreCategoryExplorer.bind(storeController));

  fastify.get('/:storeId', { schema: getStoreSchema, onRequest: [fastify.optionalAuthenticate] }, storeController.getOne.bind(storeController) as any);
  fastify.get('/:storeId/attributes', { schema: getStoreAttributesSchema }, storeController.getStoreAttributes.bind(storeController));
  fastify.get('/:storeId/categories', { schema: getStoreCategoriesSchema }, storeController.getStoreCategories.bind(storeController));
  fastify.get('/:storeId/products', { schema: listStoreProductsSchema }, storeController.listProducts.bind(storeController));
  fastify.get('/:storeId/products/:productId', { schema: getProductSchema }, storeController.getProduct.bind(storeController));

  // ─── Vendor application (Public/Authenticated) ─────────────────────────────
  fastify.post(
    '/',
    { schema: createStoreSchema },
    storeController.create.bind(storeController) as any,
  );

  // ─── Admin-only endpoints (Require Authentication) ──────────────────────────
  fastify.patch(
    '/:storeId/approval',
    {
      schema: approveVendorSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    storeController.approveVendor.bind(storeController) as any,
  );

  fastify.patch(
    '/:storeId/active',
    {
      schema: toggleActiveSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN, Roles.VENDOR)],
    },
    storeController.toggleActive.bind(storeController) as any,
  );

  fastify.patch(
    '/:storeId',
    {
      schema: updateStoreSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN, Roles.VENDOR)],
    },
    storeController.update.bind(storeController) as any,
  );

  fastify.delete(
    '/:storeId',
    {
      schema: deleteStoreSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    storeController.remove.bind(storeController) as any,
  );
}
