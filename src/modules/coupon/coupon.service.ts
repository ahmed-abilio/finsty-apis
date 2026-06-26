import { Op, Transaction, Sequelize, type WhereOptions } from 'sequelize';
import sequelize from '@config/database';
import Order from '@modules/order/order.model';
import type { DateRange } from '@modules/store/vendorDashboard.utils';
import { fetchVendorCouponStats, type VendorCouponStats } from './vendorCouponStats';
import Coupon, {
  CouponAppliesTo,
  CouponCustomerEligibility,
  CouponMinimumRequirement,
  CouponType,
} from './coupon.model';
import CouponUsage from './coupon-usage.model';
import { AppError } from '@utils/appError';
import { Roles } from '@modules/user/user.model';
import { computeMoneyDiscount, stackMoneyDiscounts } from './couponStackMath';
import { notifyAdminsNewCouponApplication, notifyVendorCouponApproved } from '@modules/notification/notification.coupon';
import logger from '@utils/logger';

export interface CreateCouponInput {
  code: string;
  type: CouponType;
  value?: number;
  minOrderValue?: number;
  maxDiscountCap?: number | null;
  validFrom: string;
  validTo: string;
  usageLimitTotal?: number | null;
  usageLimitPerUser?: number | null;
  isStackable?: boolean;
  isFirstOrderOnly?: boolean;
  storeId?: string | null;
  categoryId?: string | null;
  appliesTo?: CouponAppliesTo;
  minimumRequirement?: CouponMinimumRequirement;
  customerEligibility?: CouponCustomerEligibility;
  // Scoped targeting arrays
  productIds?: string[] | null;
  categoryIds?: string[] | null;
  customerIds?: string[] | null;
}

export interface CouponValidationContext {
  userId: string;
  subtotal: number;
  storeId?: string | null;
  categoryId?: string | null;
  isFirstOrder?: boolean;
  // Arrays of IDs present in the current cart — required for scoped coupon checks
  cartProductIds?: string[];
  cartCategoryIds?: string[];
}

export interface AppliedDiscount {
  coupon: Coupon;
  discountAmount: number;
}

export type { VendorCouponStats };

class CouponService {
  // ─── Create ───────────────────────────────────────────────────────────────────

  async create(
    input: CreateCouponInput,
    creatorId: string,
    creatorRole: string,
    creatorStoreId?: string | null,
  ): Promise<Coupon> {
    // Vendors can only create coupons for their own store
    if (creatorRole === Roles.VENDOR) {
      if (!creatorStoreId) {
        throw AppError.forbidden('Vendor must be associated with a store', 'NO_STORE');
      }
      if (input.storeId && input.storeId !== creatorStoreId) {
        throw AppError.forbidden('You can only create coupons for your own store', 'STORE_MISMATCH');
      }
      input.storeId = creatorStoreId;
    }

    const existing = await Coupon.findOne({ where: { code: input.code.toUpperCase() } });
    if (existing) throw AppError.conflict('Coupon code already exists', 'COUPON_CODE_EXISTS');

    if (input.type === 'PERCENTAGE' && ((input.value ?? 0) <= 0 || (input.value ?? 0) > 100)) {
      throw AppError.badRequest('Percentage value must be between 1 and 100', 'INVALID_COUPON_VALUE');
    }

    // Validate scoped targeting arrays are provided when required
    const appliesTo = input.appliesTo ?? 'all_products';
    if (appliesTo === 'specific_products') {
      if (!input.productIds?.length) {
        throw AppError.badRequest(
          'productIds is required when appliesTo is specific_products',
          'MISSING_PRODUCT_IDS',
        );
      }
    }
    if (appliesTo === 'specific_categories') {
      if (!input.categoryIds?.length) {
        throw AppError.badRequest(
          'categoryIds is required when appliesTo is specific_categories',
          'MISSING_CATEGORY_IDS',
        );
      }
    }

    const customerEligibility = input.customerEligibility ?? 'everyone';
    if (customerEligibility === 'specific_customers') {
      if (!input.customerIds?.length) {
        throw AppError.badRequest(
          'customerIds is required when customerEligibility is specific_customers',
          'MISSING_CUSTOMER_IDS',
        );
      }
    }

    // Derive isFirstOrderOnly from customerEligibility when provided
    let isFirstOrderOnly = input.isFirstOrderOnly ?? false;
    if (customerEligibility === 'first_order_only') isFirstOrderOnly = true;
    else if (customerEligibility === 'everyone') isFirstOrderOnly = false;

    const isApproved = creatorRole === Roles.ADMIN;

    const coupon = await Coupon.create({
      code: input.code.toUpperCase(),
      type: input.type,
      value: input.value ?? 0,
      minOrderValue: input.minOrderValue ?? 0,
      maxDiscountCap: input.maxDiscountCap ?? null,
      validFrom: new Date(input.validFrom),
      validTo: new Date(input.validTo),
      usageLimitTotal: input.usageLimitTotal ?? null,
      usageLimitPerUser: input.usageLimitPerUser ?? null,
      isStackable: input.isStackable ?? false,
      isFirstOrderOnly,
      storeId: input.storeId ?? null,
      categoryId: input.categoryId ?? null,
      isApproved,
      createdBy: creatorId,
      appliesTo,
      minimumRequirement: input.minimumRequirement ?? 'none',
      customerEligibility,
      productIds: appliesTo === 'specific_products' ? (input.productIds ?? null) : null,
      categoryIds: appliesTo === 'specific_categories' ? (input.categoryIds ?? null) : null,
      customerIds: customerEligibility === 'specific_customers' ? (input.customerIds ?? null) : null,
    });

    if (creatorRole === Roles.VENDOR && !isApproved) {
      void notifyAdminsNewCouponApplication(coupon).catch((err) => {
        logger.error({ err, couponId: coupon.id }, 'Failed to notify admins of new coupon application');
      });
    }

    return coupon;
  }

  // ─── Admin approve ────────────────────────────────────────────────────────────

  async approve(couponId: string): Promise<Coupon> {
    const coupon = await Coupon.findByPk(couponId);
    if (!coupon) throw AppError.notFound('Coupon not found', 'COUPON_NOT_FOUND');
    if (coupon.isApproved) throw AppError.badRequest('Coupon is already approved', 'ALREADY_APPROVED');

    coupon.isApproved = true;
    await coupon.save();

    if (coupon.createdBy) {
      notifyVendorCouponApproved(coupon.createdBy, coupon);
    }

    return coupon;
  }

  // ─── Toggle active status ──────────────────────────────────────────────────────

  async toggleActive(couponId: string, requesterStoreId?: string | null): Promise<Coupon> {
    // console.log(couponId , "couponId");
    console.log(requesterStoreId , "requesterStoreId");
    const coupon = await Coupon.findByPk(couponId);
    if (!coupon) throw AppError.notFound('Coupon not found', 'COUPON_NOT_FOUND');

    // Vendors can only toggle coupons belonging to their own store
    if (requesterStoreId !== undefined) {
      if (coupon.storeId !== requesterStoreId) {
        throw AppError.forbidden('You can only toggle coupons for your own store', 'STORE_MISMATCH');
      }
    }

    const raw = (coupon as unknown as { dataValues?: Record<string, unknown> }).dataValues ?? {};
    const currentActive = Boolean(coupon.get('isActive') ?? raw.is_active ?? raw.isActive);
    await coupon.update({ isActive: !currentActive });
    return coupon;
  }

  // ─── Validate a coupon against a cart ─────────────────────────────────────────

  async validate(code: string, ctx: CouponValidationContext): Promise<AppliedDiscount> {
    const coupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });
    if (!coupon) throw AppError.notFound('Coupon not found', 'COUPON_NOT_FOUND');

    return this._validateCoupon(coupon, ctx);
  }

  /**
   * Validates multiple coupon codes in order, enforces `isStackable` when len > 1,
   * at most one FREE_DELIVERY, and combines FLAT/PERCENTAGE sequentially on remaining subtotal.
   */
  async validateStack(
    rawCodes: string[],
    ctx: CouponValidationContext,
  ): Promise<{ applied: AppliedDiscount[]; totalDiscount: number; deliveryWaived: boolean }> {
    const maxCodes = 10;
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawCodes) {
      if (raw === undefined || raw === null) continue;
      const code = String(raw).trim().toUpperCase();
      if (!code) continue;
      if (seen.has(code)) continue;
      seen.add(code);
      normalized.push(code);
      if (normalized.length > maxCodes) {
        throw AppError.badRequest(`At most ${maxCodes} coupon codes allowed`, 'COUPON_STACK_LIMIT');
      }
    }

    if (normalized.length === 0) {
      throw AppError.badRequest('At least one coupon code is required', 'COUPON_CODE_REQUIRED');
    }

    const coupons: Coupon[] = [];
    for (const code of normalized) {
      const coupon = await Coupon.findOne({ where: { code } });
      if (!coupon) throw AppError.notFound(`Coupon not found: ${code}`, 'COUPON_NOT_FOUND');
      await this._validateCoupon(coupon, ctx);
      coupons.push(coupon);
    }

    if (coupons.length > 1) {
      for (const c of coupons) {
        if (!c.isStackable) {
          throw AppError.badRequest(
            `Coupon ${c.code} cannot be combined with other coupons`,
            'COUPON_NOT_STACKABLE',
          );
        }
      }
    }

    if (coupons.filter((c) => c.type === 'FREE_DELIVERY').length > 1) {
      throw AppError.badRequest(
        'Only one free delivery coupon may be applied per order',
        'COUPON_FREE_DELIVERY_DUPLICATE',
      );
    }

    const { lineDiscounts, totalDiscount } = stackMoneyDiscounts(
      coupons.map((c) => ({
        type: c.type,
        value: Number(c.value),
        maxDiscountCap: c.maxDiscountCap !== null ? Number(c.maxDiscountCap) : null,
      })),
      ctx.subtotal,
    );

    const applied: AppliedDiscount[] = [];
    let deliveryWaived = false;

    for (let i = 0; i < coupons.length; i++) {
      const coupon = coupons[i]!;
      if (coupon.type === 'FREE_DELIVERY') deliveryWaived = true;
      applied.push({ coupon, discountAmount: lineDiscounts[i] ?? 0 });
    }

    return { applied, totalDiscount, deliveryWaived };
  }

  // ─── Internal validation (reused for auto-apply) ──────────────────────────────

  async _validateCoupon(
    coupon: Coupon,
    ctx: CouponValidationContext,
    silent = false,
  ): Promise<AppliedDiscount> {
    const now = new Date();
    const fail = (msg: string, code: string) => {
      if (silent) throw new Error(code);
      throw AppError.badRequest(msg, code);
    };

    if (!coupon.isApproved) fail('Coupon is not yet approved', 'COUPON_NOT_APPROVED');
    if (!coupon.isActive) fail('Coupon is currently inactive', 'COUPON_INACTIVE');
    if (!coupon.readyToUse) fail('Coupon is not yet available for use', 'COUPON_NOT_READY');

    if (now < coupon.validFrom || now > coupon.validTo) {
      fail('Coupon has expired or is not yet active', 'COUPON_EXPIRED');
    }

    if (ctx.subtotal < Number(coupon.minOrderValue)) {
      fail(`Minimum order value of ${coupon.minOrderValue} not met`, 'COUPON_MIN_ORDER_NOT_MET');
    }

    // ── Store scope ──────────────────────────────────────────────────────────────
    if (coupon.storeId && coupon.storeId !== ctx.storeId) {
      fail('Coupon is not valid for this store', 'COUPON_STORE_MISMATCH');
    }

    // ── appliesTo checks ─────────────────────────────────────────────────────────
    if (coupon.appliesTo === 'specific_products') {
      // At least one product in the cart must be in the coupon's productIds list
      const allowed = coupon.productIds ?? [];
      const cartIds = ctx.cartProductIds ?? [];
      const hasMatch = cartIds.some((id) => allowed.includes(id));
      if (!hasMatch) {
        fail('Coupon is not valid for the products in your cart', 'COUPON_PRODUCT_MISMATCH');
      }
    }

    if (coupon.appliesTo === 'specific_categories') {
      // At least one category in the cart must be in the coupon's categoryIds list
      const allowed = coupon.categoryIds ?? [];
      const cartCats = ctx.cartCategoryIds ?? [];
      // Also support the legacy single categoryId on the context
      const allCartCats = ctx.categoryId ? [...new Set([...cartCats, ctx.categoryId])] : cartCats;
      const hasMatch = allCartCats.some((id) => allowed.includes(id));
      if (!hasMatch) {
        fail('Coupon is not valid for the categories in your cart', 'COUPON_CATEGORY_MISMATCH');
      }
    }

    // Legacy single-categoryId check (for old coupons created before categoryIds array)
    if (coupon.appliesTo === 'all_products' && coupon.categoryId && coupon.categoryId !== ctx.categoryId) {
      fail('Coupon is not valid for this category', 'COUPON_CATEGORY_MISMATCH');
    }

    // ── customerEligibility checks ───────────────────────────────────────────────
    if (coupon.customerEligibility === 'first_order_only' || coupon.isFirstOrderOnly) {
      if (!ctx.isFirstOrder) {
        fail('Coupon is only valid for your first order', 'COUPON_FIRST_ORDER_ONLY');
      }
    }

    if (coupon.customerEligibility === 'specific_customers') {
      const allowed = coupon.customerIds ?? [];
      if (!allowed.includes(ctx.userId)) {
        fail('You are not eligible to use this coupon', 'COUPON_CUSTOMER_NOT_ELIGIBLE');
      }
    }

    // ── Usage limits ─────────────────────────────────────────────────────────────
    if (coupon.usageLimitTotal !== null) {
      const totalUsed = await CouponUsage.count({ where: { couponId: coupon.id } });
      if (totalUsed >= coupon.usageLimitTotal) {
        fail('Coupon usage limit has been reached', 'COUPON_USAGE_LIMIT_REACHED');
      }
    }

    if (coupon.usageLimitPerUser !== null) {
      const userUsed = await CouponUsage.count({
        where: { couponId: coupon.id, userId: ctx.userId },
      });
      if (userUsed >= coupon.usageLimitPerUser) {
        fail('You have already used this coupon the maximum number of times', 'COUPON_USER_LIMIT_REACHED');
      }
    }

    const discountAmount = this._calculateDiscount(coupon, ctx.subtotal);
    return { coupon, discountAmount };
  }

  // ─── Calculate discount amount ────────────────────────────────────────────────

  private _calculateDiscount(coupon: Coupon, subtotal: number): number {
    return computeMoneyDiscount(
      coupon.type,
      Number(coupon.value),
      coupon.maxDiscountCap !== null ? Number(coupon.maxDiscountCap) : null,
      subtotal,
    );
  }

  // ─── Auto-apply best coupon ───────────────────────────────────────────────────

  async autoApplyBest(ctx: CouponValidationContext): Promise<AppliedDiscount | null> {
    const now = new Date();

    // Pre-filter in SQL for the cheap cases; specific_products / specific_customers
    // are validated in the loop since SQL can't efficiently check JSONB intersection
    const candidates = await Coupon.findAll({
      where: {
        isApproved: true,
        isActive: true,
        readyToUse: true,
        validFrom: { [Op.lte]: now },
        validTo: { [Op.gte]: now },
        minOrderValue: { [Op.lte]: ctx.subtotal },
        [Op.and]: [
          {
            [Op.or]: [
              { storeId: null },
              ...(ctx.storeId ? [{ storeId: ctx.storeId }] : []),
            ],
          },
          {
            [Op.or]: [
              { isFirstOrderOnly: false },
              ...(ctx.isFirstOrder ? [{ isFirstOrderOnly: true }] : []),
            ],
          },
        ],
      },
    });

    let best: AppliedDiscount | null = null;

    for (const coupon of candidates) {
      try {
        const result = await this._validateCoupon(coupon, ctx, true);
        if (!best || result.discountAmount > best.discountAmount) {
          best = result;
        }
      } catch {
        // skip invalid coupons silently
      }
    }

    return best;
  }

  // ─── Record usage (called inside order transaction) ───────────────────────────

  async recordUsage(
    couponId: string,
    userId: string,
    orderId: string,
    t: Transaction,
  ): Promise<void> {
    await CouponUsage.create({ couponId, userId, orderId }, { transaction: t });
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  async getVendorCouponStats(storeId: string, range?: DateRange): Promise<VendorCouponStats> {
    return fetchVendorCouponStats(storeId, range);
  }

  async listVendorCoupons(
    storeId: string,
    filters: { page?: number; limit?: number; isActive?: boolean } = {},
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { storeId };
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const { count, rows } = await Coupon.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((c) => c.toPublicJSON()),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async toggleReadyToUse(couponId: string): Promise<Coupon> {
    const coupon = await Coupon.findByPk(couponId);
    if (!coupon) throw AppError.notFound('Coupon not found', 'COUPON_NOT_FOUND');
    await coupon.update({ readyToUse: !coupon.readyToUse });
    return coupon;
  }

  async list(
    filters: {
      storeId?: string;
      includeGlobal?: boolean;
      isApproved?: boolean;
      isActive?: boolean;
      readyToUse?: boolean;
      userId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const storeScope: WhereOptions =
      filters.storeId !== undefined
        ? filters.includeGlobal
          ? { [Op.or]: [{ storeId: null }, { storeId: filters.storeId }] }
          : { storeId: filters.storeId }
        : filters.includeGlobal
          ? { storeId: null }
          : {};

    const userAndConditions: WhereOptions[] = [];

    if (filters.userId) {
      const deliveredCount = await Order.count({
        where: { userId: filters.userId, status: 'delivered' },
      });

      if (deliveredCount >= 1) {
        userAndConditions.push({
          isFirstOrderOnly: false,
          customerEligibility: { [Op.ne]: 'first_order_only' },
        });
      }

      const escapedUserId = sequelize.escape(filters.userId);
      userAndConditions.push(
        Sequelize.literal(
          `NOT ("Coupon"."usage_limit_per_user" IS NOT NULL AND ` +
            `(SELECT COUNT(*) FROM "coupon_usages" WHERE "coupon_id" = "Coupon"."id" AND "user_id" = ${escapedUserId}) >= "Coupon"."usage_limit_per_user")`,
        ) as unknown as WhereOptions,
      );
    }

    const where: WhereOptions = {
      ...storeScope,
      ...(filters.isApproved !== undefined ? { isApproved: filters.isApproved } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.readyToUse !== undefined ? { readyToUse: filters.readyToUse } : {}),
      ...(userAndConditions.length > 0 ? { [Op.and]: userAndConditions } : {}),
    };

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await Coupon.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((c) => c.toPublicJSON()),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ─── Get by code (public validation info) ────────────────────────────────────

  async getByCode(code: string): Promise<Coupon> {
    const coupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });
    if (!coupon) throw AppError.notFound('Coupon not found', 'COUPON_NOT_FOUND');
    return coupon;
  }
}

export default new CouponService();
