import { FastifyRequest, FastifyReply } from 'fastify';
import couponService, { CreateCouponInput } from './coupon.service';
import Store from '@modules/store/store.model';
import { AppError } from '@utils/appError';
import { parseRevenueDateRange } from '@modules/store/vendorDashboard.utils';

interface CouponParams {
  couponId: string;
}

interface ValidateQuery {
  code?: string;
  couponCodes?: string[];
  subtotal: number;
  storeId?: string;
  categoryId?: string;
  cartProductIds?: string[];
  cartCategoryIds?: string[];
}

interface ListQuery {
  storeId?: string;
  includeGlobal?: boolean;
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
    const { code, couponCodes, subtotal, storeId, categoryId, cartProductIds, cartCategoryIds } =
      request.query;

    const codes =
      couponCodes && couponCodes.length > 0 ? couponCodes : code ? [code] : [];
    if (codes.length === 0) {
      throw AppError.badRequest('At least one coupon code is required', 'COUPON_CODE_REQUIRED');
    }

    const completedOrderCount = await import('@modules/order/order.model').then(({ default: Order }) =>
      Order.count({ where: { userId: request.user.sub, status: 'delivered' } }),
    );

    const stack = await couponService.validateStack(codes, {
      userId: request.user.sub,
      subtotal,
      storeId: storeId ?? null,
      categoryId: categoryId ?? null,
      isFirstOrder: completedOrderCount === 0,
      cartProductIds: cartProductIds ?? [],
      cartCategoryIds: cartCategoryIds ?? [],
    });

    const applied = stack.applied.map((a) => ({
      coupon: a.coupon.toPublicJSON(),
      discountAmount: a.discountAmount,
    }));

    const data: Record<string, unknown> = {
      applied,
      totalDiscount: stack.totalDiscount,
      deliveryWaived: stack.deliveryWaived,
    };

    if (applied.length === 1) {
      data.coupon = applied[0]!.coupon;
      data.discountAmount = applied[0]!.discountAmount;
    }

    void reply.status(200).send({ success: true, data });
  }

  async list(
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await couponService.list({
      storeId: request.query.storeId,
      includeGlobal: request.query.includeGlobal === true,
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

  async getVendorCouponStats(
    request: FastifyRequest<{ Querystring: { from?: string; to?: string } }>,
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

    const { from, to } = request.query;
    let range: ReturnType<typeof parseRevenueDateRange> | undefined;

    if (from !== undefined || to !== undefined) {
      if (!from || !to) {
        throw AppError.badRequest(
          'Both from and to are required when filtering by date',
          'INVALID_DATE_RANGE',
        );
      }
      try {
        range = parseRevenueDateRange(from, to);
      } catch (err) {
        const code = (err as Error).message === 'INVALID_RANGE' ? 'INVALID_DATE_RANGE' : 'INVALID_DATE';
        const message =
          (err as Error).message === 'INVALID_RANGE'
            ? 'to must be greater than or equal to from'
            : 'from and to must be valid ISO timestamps';
        throw AppError.badRequest(message, code);
      }
    }

    const stats = await couponService.getVendorCouponStats(store.id, range);
    void reply.status(200).send({ success: true, data: stats });
  }

  async getVendorCoupons(
    request: FastifyRequest<{
      Querystring: { page?: number; limit?: number; isActive?: boolean };
    }>,
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
      ...(request.query.isActive !== undefined ? { isActive: request.query.isActive } : {}),
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
