import { FastifyInstance } from 'fastify';
import brandController from './brand.controller';
import {
  listStoreBrandsSchema,
  createStoreBrandSchema,
  updateStoreBrandSchema,
  deleteStoreBrandSchema,
} from './brand.schema';
import { Roles } from '@modules/user/user.model';

export default async function brandRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /stores/:storeId/brands — vendor can list their own store's brands
  fastify.get(
    '/:storeId/brands',
    {
      schema: listStoreBrandsSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    brandController.list.bind(brandController) as any,
  );

  // POST /stores/:storeId/brands — create a brand for a store
  fastify.post(
    '/:storeId/brands',
    {
      schema: createStoreBrandSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    brandController.create.bind(brandController) as any,
  );

  // PATCH /stores/:storeId/brands/:brandId — update a brand
  fastify.patch(
    '/:storeId/brands/:brandId',
    {
      schema: updateStoreBrandSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    brandController.update.bind(brandController) as any,
  );

  // DELETE /stores/:storeId/brands/:brandId — toggle brand active status
  fastify.delete(
    '/:storeId/brands/:brandId',
    {
      schema: deleteStoreBrandSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    brandController.remove.bind(brandController) as any,
  );
}
