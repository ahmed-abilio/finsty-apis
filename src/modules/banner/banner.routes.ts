import { FastifyInstance } from 'fastify';
import bannerController from './banner.controller';
import {
  createPriceBannerSchema,
  updatePriceBannerSchema,
  deletePriceBannerSchema,
  adminListPriceBannersSchema,
  createStoreDiscountBannerSchema,
  updateStoreDiscountBannerSchema,
  approveStoreDiscountBannerSchema,
  deleteStoreDiscountBannerSchema,
  adminListStoreDiscountBannersSchema,
  vendorCreateStoreDiscountBannerSchema,
  vendorListStoreDiscountBannersSchema,
  listActiveBannersSchema,
} from './banner.schema';
import { Roles } from '@modules/user/user.model';
import type {
  CreatePriceBannerInput,
  UpdatePriceBannerInput,
  CreateStoreDiscountBannerInput,
  UpdateStoreDiscountBannerInput,
  VendorCreateStoreDiscountBannerInput,
} from './banner.service';

interface BannerParams {
  bannerId: string;
}

// ─── Admin banner routes (/api/v1/admin/banners) ───────────────────────────────

export async function adminBannerRoutes(fastify: FastifyInstance): Promise<void> {
  // fastify.addHook('onRequest', fastify.authenticate);
  // fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  // ── Price banners ────────────────────────────────────────────────────────────

  // GET /admin/banners/price
  fastify.get(
    '/price',
    { schema: adminListPriceBannersSchema },
    bannerController.adminListPriceBanners.bind(bannerController),
  );

  // POST /admin/banners/price
  fastify.post<{ Body: CreatePriceBannerInput }>(
    '/price',
    { schema: createPriceBannerSchema , onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)]},
    bannerController.createPriceBanner.bind(bannerController),
  );

  // PATCH /admin/banners/price/:bannerId
  fastify.patch<{ Params: BannerParams; Body: UpdatePriceBannerInput }>(
    '/price/:bannerId',
    { schema: updatePriceBannerSchema },
    bannerController.updatePriceBanner.bind(bannerController),
  );

  // DELETE /admin/banners/price/:bannerId
  fastify.delete<{ Params: BannerParams }>(
    '/price/:bannerId',
    { schema: deletePriceBannerSchema , onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)]},
    bannerController.deletePriceBanner.bind(bannerController),
  );

  // ── Store discount banners ───────────────────────────────────────────────────

  // GET /admin/banners/store-discount
  fastify.get(
    '/store-discount',
    { schema: adminListStoreDiscountBannersSchema },
    bannerController.adminListStoreDiscountBanners.bind(bannerController),
  );

  // POST /admin/banners/store-discount
  fastify.post<{ Body: CreateStoreDiscountBannerInput }>(
    '/store-discount',
    { schema: createStoreDiscountBannerSchema , onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)]},
    bannerController.createStoreDiscountBanner.bind(bannerController),
  );

  // PATCH /admin/banners/store-discount/:bannerId
  fastify.patch<{ Params: BannerParams; Body: UpdateStoreDiscountBannerInput }>(
    '/store-discount/:bannerId',
    { schema: updateStoreDiscountBannerSchema , onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)]},
    bannerController.updateStoreDiscountBanner.bind(bannerController),
  );

  // POST /admin/banners/store-discount/:bannerId/approve
  fastify.post<{ Params: BannerParams }>(
    '/store-discount/:bannerId/approve',
    { schema: approveStoreDiscountBannerSchema , onRequest: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)]},
    bannerController.approveStoreDiscountBanner.bind(bannerController),
  );

  // DELETE /admin/banners/store-discount/:bannerId
  fastify.delete<{ Params: BannerParams }>(
    '/store-discount/:bannerId',
    { schema: deleteStoreDiscountBannerSchema },
    bannerController.deleteStoreDiscountBanner.bind(bannerController),
  );
}

// ─── Vendor / public banner routes (/api/v1/banners) ──────────────────────────

export async function publicBannerRoutes(fastify: FastifyInstance): Promise<void> {
  // fastify.addHook('onRequest', fastify.authenticate);

  // GET /banners/active — storefront home page banners (all authenticated users)
  fastify.get(
    '/active',
    { schema: listActiveBannersSchema },
    bannerController.listActiveBanners.bind(bannerController),
  );

  // GET /banners/my-store — vendor sees their own store's banners
  fastify.get(
    '/my-store',
    {
      schema: vendorListStoreDiscountBannersSchema,
      onRequest: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    bannerController.vendorListStoreDiscountBanners.bind(bannerController),
  );

  // POST /banners/store-discount — vendor creates a banner for their own store
  fastify.post<{ Body: VendorCreateStoreDiscountBannerInput }>(
    '/store-discount',
    {
      schema: vendorCreateStoreDiscountBannerSchema,
      onRequest: [fastify.authenticate, fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    bannerController.vendorCreateStoreDiscountBanner.bind(bannerController),
  );
}
