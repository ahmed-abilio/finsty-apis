import { FastifyRequest, FastifyReply } from 'fastify';
import couponService, { CreateCouponInput } from './coupon.service';
import Store from '@modules/store/store.model';

interface CouponParams {
  couponId: string;
}

interface ValidateQuery {
  code: string;
  subtotal: number;
  storeId?: string;
  categoryId?: string;
  cartProductIds?: string[];
  cartCategoryIds?: string[];
}

interface ListQuery {
  storeId?: string;
  isApproved?: boolean;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

class CouponController {
  async create(
    request: FastifyRequest<{ Body: CreateCouponInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { sub: creatorId, role } = request.user;

    // For vendors, resolve their storeId from the Store table
    let creatorStoreId: string | null = null;
    if (role === 'vendor') {
      const store = await Store.findOne({ where: { ownerId: creatorId } });
      if (!store) {
        void reply.status(403).send({
          success: false,
          error: { code: 'NO_STORE', message: 'Vendor has no associated store' },
        });
        return;
      }
      creatorStoreId = store.id;
    }

    const coupon = await couponService.create(request.body, creatorId, role, creatorStoreId);
    void reply.status(201).send({ success: true, data: { coupon: coupon.toPublicJSON() } });
  }

  async approve(
    request: FastifyRequest<{ Params: CouponParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const coupon = await couponService.approve(request.params.couponId);
    void reply.status(200).send({ success: true, data: { coupon: coupon.toPublicJSON() } });
  }

  async toggleActive(
    request: FastifyRequest<{ Params: CouponParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    // Admin — no store ownership check (pass undefined)
    const coupon = await couponService.toggleActive(request.params.couponId);
    void reply.status(200).send({ success: true, data: { coupon: coupon.toPublicJSON() } });
  }

  async vendorToggleActive(
    request: FastifyRequest<{ Params: CouponParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    // Resolve vendor's store to enforce ownership
    const store = await Store.findOne({ where: { ownerId: request.user.sub } });
    if (!store) {
      void reply.status(403).send({
        success: false,
        error: { code: 'NO_STORE', message: 'Vendor has no associated store' },
      });
      return;
    }

    const coupon = await couponService.toggleActive(request.params.couponId, store.id);
    void reply.status(200).send({ success: true, data: { coupon: coupon.toPublicJSON() } });
  }

  async validate(
    request: FastifyRequest<{ Querystring: ValidateQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { code, subtotal, storeId, categoryId, cartProductIds, cartCategoryIds } = request.query;

    // Check if this is the user's first order
    const completedOrderCount = await import('@modules/order/order.model').then(({ default: Order }) =>
      Order.count({ where: { userId: request.user.sub, status: 'delivered' } }),
    );

    const result = await couponService.validate(code, {
      userId: request.user.sub,
      subtotal,
      storeId: storeId ?? null,
      categoryId: categoryId ?? null,
      isFirstOrder: completedOrderCount === 0,
      cartProductIds: cartProductIds ?? [],
      cartCategoryIds: cartCategoryIds ?? [],
    });

    void reply.status(200).send({
      success: true,
      data: {
        coupon: result.coupon.toPublicJSON(),
        discountAmount: result.discountAmount,
      },
    });
  }

  async list(
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await couponService.list({
      storeId: request.query.storeId,
      isApproved: true,
      isActive: true,
      readyToUse: true,
      userId: request.user.sub,
      page: request.query.page,
      limit: request.query.limit,
    });
    void reply.status(200).send({
      success: true,
      data: {
        items: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  async getVendorCoupons(
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const store = await Store.findOne({ where: { ownerId: request.user.sub } });
    if (!store) {
      void reply.status(403).send({
        success: false,
        error: { code: 'NO_STORE', message: 'Vendor has no associated store' },
      });
      return;
    }

    const result = await couponService.listVendorCoupons(store.id, {
      page: request.query.page,
      limit: request.query.limit,
    });
    void reply.status(200).send({
      success: true,
      data: {
        items: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  async toggleReadyToUse(
    request: FastifyRequest<{ Params: CouponParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const coupon = await couponService.toggleReadyToUse(request.params.couponId);
    void reply.status(200).send({ success: true, data: { coupon: coupon.toPublicJSON() } });
  }

  async adminList(
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const filters: { storeId?: string; isApproved?: boolean; isActive?: boolean; page?: number; limit?: number } = {};
    if (request.query.storeId) filters.storeId = request.query.storeId;
    if (request.query.isApproved !== undefined) filters.isApproved = request.query.isApproved;
    if (request.query.isActive !== undefined) filters.isActive = request.query.isActive;
    filters.page = request.query.page;
    filters.limit = request.query.limit;

    const result = await couponService.list(filters);
    void reply.status(200).send({
      success: true,
      data: {
        items: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }
}

export default new CouponController();
