import { FastifyInstance } from 'fastify';
import couponController from './coupon.controller';
import {
  createCouponSchema,
  approveCouponSchema,
  toggleCouponSchema,
  validateCouponSchema,
  listCouponsSchema,
  adminListCouponsSchema,
  vendorListCouponsSchema,
  vendorCouponStatsSchema,
  toggleReadyToUseSchema,
} from './coupon.schema';
import { Roles } from '@modules/user/user.model';
import type { CreateCouponInput } from './coupon.service';

// ─── Public / user-facing coupon routes (/api/v1/coupons) ─────────────────────
export async function couponRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  // GET /coupons — list approved coupons
  fastify.get('/', { schema: listCouponsSchema }, couponController.list.bind(couponController));

  // GET /coupons/validate — validate a coupon against a cart
  fastify.get('/validate', { schema: validateCouponSchema }, couponController.validate.bind(couponController));

  // POST /coupons — create a coupon (vendor or admin)
  fastify.post<{ Body: CreateCouponInput }>(
    '/',
    {
      schema: createCouponSchema,
      onRequest: [fastify.requireRole(Roles.VENDOR, Roles.ADMIN)],
    },
    couponController.create.bind(couponController),
  );

  // GET /coupons/my-stats — vendor coupon aggregates (before /:couponId routes)
  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    '/my-stats',
    {
      schema: vendorCouponStatsSchema,
      onRequest: [fastify.requireRole(Roles.VENDOR)],
    },
    couponController.getVendorCouponStats.bind(couponController),
  );

  // GET /coupons/my-coupons — vendor lists all their store's coupons
  fastify.get<{ Querystring: { page?: number; limit?: number } }>(
    '/my-coupons',
    {
      schema: vendorListCouponsSchema,
      onRequest: [fastify.requireRole(Roles.VENDOR)],
    },
    couponController.getVendorCoupons.bind(couponController),
  );

  // PATCH /coupons/:couponId/toggle — vendor toggles their own coupon active/inactive
  fastify.patch<{ Params: { couponId: string } }>(
    '/:couponId/toggle',
    {
      schema: toggleCouponSchema,
      onRequest: [fastify.requireRole(Roles.VENDOR)],
    },
    couponController.vendorToggleActive.bind(couponController),
  );
}

// ─── Admin coupon routes (/api/v1/admin/coupons) ───────────────────────────────
export async function adminCouponRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  // GET /admin/coupons — list all coupons including unapproved
  fastify.get('/', { schema: adminListCouponsSchema }, couponController.adminList.bind(couponController));

  // POST /admin/coupons/:couponId/approve — approve a vendor coupon
  fastify.post(
    '/:couponId/approve',
    { schema: approveCouponSchema },
    couponController.approve.bind(couponController),
  );

  // PATCH /admin/coupons/:couponId/toggle — toggle active/inactive
  fastify.patch(
    '/:couponId/toggle',
    { schema: toggleCouponSchema },
    couponController.toggleActive.bind(couponController),
  );

  // PATCH /admin/coupons/:couponId/ready-to-use — toggle readyToUse flag
  fastify.patch(
    '/:couponId/ready-to-use',
    { schema: toggleReadyToUseSchema },
    couponController.toggleReadyToUse.bind(couponController),
  );
}
