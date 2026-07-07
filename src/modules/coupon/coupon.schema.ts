import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

// ─── Shared shapes ─────────────────────────────────────────────────────────────

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const couponObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    type: { type: 'string', enum: ['FLAT', 'PERCENTAGE', 'FREE_DELIVERY'] },
    value: { type: 'number' },
    minOrderValue: { type: 'number' },
    maxDiscountCap: { type: 'number', nullable: true },
    validFrom: { type: 'string' },
    validTo: { type: 'string' },
    usageLimitTotal: { type: 'number', nullable: true },
    usageLimitPerUser: { type: 'number', nullable: true },
    isStackable: { type: 'boolean' },
    isFirstOrderOnly: { type: 'boolean' },
    storeId: { type: 'string', nullable: true },
    categoryId: { type: 'string', nullable: true },
    isApproved: { type: 'boolean' },
    isActive: { type: 'boolean' },
    createdBy: { type: 'string' },
    appliesTo: { type: 'string', enum: ['all_products', 'specific_products', 'specific_categories'] },
    minimumRequirement: { type: 'string', enum: ['none', 'minimum_order_value', 'minimum_quantity'] },
    customerEligibility: { type: 'string', enum: ['everyone', 'first_order_only', 'specific_customers'] },
    productIds: { type: 'array', items: { type: 'string' }, nullable: true },
    categoryIds: { type: 'array', items: { type: 'string' }, nullable: true },
    customerIds: { type: 'array', items: { type: 'string' }, nullable: true },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const createCouponBody = {
  type: 'object',
  required: ['code', 'type', 'validFrom', 'validTo'],
  properties: {
    code: {
      type: 'string',
      minLength: 1,
      description:
        'Unique coupon code. Leading/trailing spaces are trimmed; value is uppercased. ' +
        'After normalization: 3–30 characters, A-Z, 0-9, underscore (_), hyphen (-) only.',
    },
    type: {
      type: 'string',
      enum: ['FLAT', 'PERCENTAGE', 'FREE_DELIVERY'],
      description: 'FLAT = fixed amount off, PERCENTAGE = % off subtotal, FREE_DELIVERY = waives delivery charge',
    },
    value: {
      type: 'number',
      minimum: 0,
      description: 'Amount (FLAT) or percentage (PERCENTAGE). Omit or send 0 for FREE_DELIVERY.',
    },
    minOrderValue: {
      type: 'number',
      minimum: 0,
      description: 'Minimum cart subtotal required to apply this coupon',
    },
    maxDiscountCap: {
      type: 'number',
      nullable: true,
      minimum: 0,
      description: 'Cap on the discount amount (only for PERCENTAGE type)',
    },
    validFrom: { type: 'string', format: 'date-time', description: 'ISO 8601 start date' },
    validTo: { type: 'string', format: 'date-time', description: 'ISO 8601 expiry date' },
    usageLimitTotal: {
      type: 'number',
      nullable: true,
      minimum: 1,
      description: 'Max total redemptions across all users. Null = unlimited.',
    },
    usageLimitPerUser: {
      type: 'number',
      nullable: true,
      minimum: 1,
      description: 'Max times a single user can apply this coupon. Null = unlimited.',
    },
    isStackable: {
      type: 'boolean',
      description: 'Whether this coupon can be combined with others (reserved for future use)',
    },
    isFirstOrderOnly: {
      type: 'boolean',
      description: 'Restrict to users placing their first order',
    },
    storeId: {
      type: 'string',
      nullable: true,
      description: 'Restrict to a specific store. Vendors auto-inherit their own storeId.',
    },
    categoryId: {
      type: 'string',
      nullable: true,
      description: 'Restrict to a specific product category',
    },
    appliesTo: {
      type: 'string',
      enum: ['all_products', 'specific_products', 'specific_categories'],
      description: 'Which products this coupon applies to',
    },
    minimumRequirement: {
      type: 'string',
      enum: ['none', 'minimum_order_value', 'minimum_quantity'],
      description: 'Type of minimum requirement to activate this coupon',
    },
    customerEligibility: {
      type: 'string',
      enum: ['everyone', 'first_order_only', 'specific_customers'],
      description: 'Who can use this coupon. first_order_only also sets isFirstOrderOnly=true.',
    },
    productIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Required when appliesTo is specific_products. List of product UUIDs.',
    },
    categoryIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Required when appliesTo is specific_categories. List of category UUIDs.',
    },
    customerIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Required when customerEligibility is specific_customers. List of user UUIDs.',
    },
  },
  additionalProperties: false,
} as const;

// ─── POST /coupons (vendor creates coupon) ─────────────────────────────────────

export const createCouponSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Create a coupon (vendor or admin)',
  description:
    'Vendors create store-scoped coupons — they are pending admin approval (isApproved=false). ' +
    'Admin-created coupons are immediately approved.',
  security: [{ BearerAuth: [] }],
  body: createCouponBody,
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { coupon: couponObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    409: errorResponse,
  },
};

// ─── POST /admin/coupons/:couponId/approve ─────────────────────────────────────

export const approveCouponSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Approve a vendor-created coupon (admin only)',
  description: 'Sets isApproved=true so the coupon becomes active for customers.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['couponId'],
    properties: { couponId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { coupon: couponObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── POST /admin/coupons/:couponId/reject ──────────────────────────────────────

export const rejectCouponSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Reject a vendor-created coupon (admin only)',
  description:
    'Marks coupon as rejected by forcing it inactive. Rejected coupons remain unapproved.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['couponId'],
    properties: { couponId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { coupon: couponObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── PATCH /admin/coupons/:couponId/toggle ─────────────────────────────────────

export const toggleCouponSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Toggle coupon active/inactive (vendor only)',
  description: 'Flips the isActive flag. Inactive coupons cannot be applied even if approved.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['couponId'],
    properties: { couponId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { coupon: couponObject } },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

const appliedCouponLine = {
  type: 'object',
  properties: {
    coupon: couponObject,
    discountAmount: { type: 'number', description: 'Discount from this coupon on the running subtotal' },
  },
} as const;

// ─── GET /coupons/validate ─────────────────────────────────────────────────────

export const validateCouponSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Validate coupon(s) for the current cart',
  description:
    'Returns computed discount(s) for one or more coupon codes against the given cart context. ' +
    'Send `couponCodes` (repeat query param) for stackable checkout preview; `code` remains supported for a single coupon. ' +
    'When multiple codes are used, every coupon must have `isStackable: true`, at most one `FREE_DELIVERY` is allowed, and ' +
    'FLAT/PERCENTAGE discounts apply sequentially on the remaining subtotal in request order. ' +
    'Does NOT redeem coupons — redemption happens when the order is created.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    required: ['subtotal'],
    properties: {
      code: {
        type: 'string',
        description: 'Single coupon code (legacy). Ignored when `couponCodes` is non-empty.',
      },
      couponCodes: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Multiple coupon codes (same as checkout `couponCodes`). Repeat param, e.g. `?couponCodes=A&couponCodes=B`.',
      },
      subtotal: { type: 'number', exclusiveMinimum: 0, description: 'Cart subtotal (before tax/delivery)' },
      storeId: { type: 'string', description: 'Store ID for store-scoped coupons' },
      categoryId: { type: 'string', description: 'Single category ID (legacy)' },
      cartProductIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Product IDs in the cart — required for specific_products coupons',
      },
      cartCategoryIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Category IDs in the cart — required for specific_categories coupons',
      },
    },
    anyOf: [{ required: ['code'] }, { required: ['couponCodes'] }],
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            applied: {
              type: 'array',
              items: appliedCouponLine,
              description: 'Each coupon in request order with its line discount',
            },
            totalDiscount: {
              type: 'number',
              description: 'Sum of money-off discounts (capped at subtotal)',
            },
            deliveryWaived: {
              type: 'boolean',
              description: 'True when a FREE_DELIVERY coupon is in the stack',
            },
            coupon: couponObject,
            discountAmount: {
              type: 'number',
              description: 'Same as the sole applied line when only one coupon (legacy clients)',
            },
          },
        },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    404: errorResponse,
  },
};

// ─── GET /coupons ─────────────────────────────────────────────────────────────

export const listCouponsSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'List approved coupons',
  description:
    'Returns active, approved coupons for the authenticated user. ' +
    'By default, `storeId` returns only that store’s coupons. ' +
    'Set `includeGlobal=true` with `storeId` to also include platform-wide coupons (`storeId` null). ' +
    'With `includeGlobal=true` and no `storeId`, only global coupons are returned.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      storeId: {
        type: 'string',
        description: 'Filter to a store’s coupons. Use with `includeGlobal` to add platform-wide coupons.',
      },
      includeGlobal: {
        type: 'boolean',
        default: false,
        description:
          'When `true` and `storeId` is set: return that store’s coupons plus global coupons. ' +
          'When `true` without `storeId`: return only global coupons.',
      },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: couponObject },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
    401: errorResponse,
  },
};
// ─── GET /coupons/my-coupons (vendor) ─────────────────────────────────────────

export const vendorListCouponsSchema: FastifySchema = {
  tags: ['Coupons'],
  operationId: 'listVendorCoupons',
  summary: 'GET /coupons/my-coupons — all store coupons (vendor)',
  description:
    '**Path:** `GET /api/v1/coupons/my-coupons` — vendor only.\n\n' +
    'Returns every coupon for the vendor\'s store, including **inactive** (`isActive=false`), ' +
    'unapproved, and not-ready coupons. Omit `isActive` to return all statuses.\n\n' +
    'Optional `isActive=true` or `isActive=false` narrows the list. ' +
    'Customer-facing `GET /coupons` only returns active approved coupons — use this endpoint for vendor management.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'number', minimum: 1, default: 1, description: 'Page number (1-based)' },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Coupons per page (max 100)',
      },
      isActive: {
        type: 'boolean',
        description:
          'Optional filter. Omit to include both active and inactive coupons. `false` returns only inactive.',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: couponObject },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── GET /coupons/my-stats (vendor) ───────────────────────────────────────────

const vendorCouponStatsData = {
  type: 'object',
  properties: {
    totalCoupons: { type: 'number', description: 'Total coupons created for this store' },
    activeCount: { type: 'number', description: 'Coupons with isActive=true' },
    inactiveCount: { type: 'number', description: 'Coupons with isActive=false' },
    usedCount: {
      type: 'number',
      description:
        'Number of coupon redemptions on qualifying orders (confirmed, processing, shipped, delivered)',
    },
    totalDiscountAmount: {
      type: 'number',
      description:
        'Sum of per-coupon discount amounts from order metadata.appliedCoupons on qualifying orders',
    },
  },
} as const;

export const vendorCouponStatsSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Vendor coupon statistics for own store',
  description:
    'Returns aggregate coupon metrics for the authenticated vendor\'s store: total coupons, active/inactive counts, ' +
    'redemption count, and total discount given. Usage and discount totals only include orders with status ' +
    '`confirmed`, `processing`, `shipped`, or `delivered`. Optional `from`/`to` filter usage metrics by order createdAt.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      from: {
        type: 'string',
        format: 'date-time',
        description: 'Filter usage/discount metrics from this timestamp (inclusive). Omit for all time.',
      },
      to: {
        type: 'string',
        format: 'date-time',
        description: 'Filter usage/discount metrics until this timestamp (inclusive). Omit for all time.',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: vendorCouponStatsData,
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── GET /admin/coupons ────────────────────────────────────────────────────────

export const adminListCouponsSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'List all coupons including unapproved (admin only)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      isApproved: { type: 'boolean' },
      isActive: { type: 'boolean' },
      storeId: { type: 'string' },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: couponObject },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── GET /admin/coupons/:couponId ──────────────────────────────────────────────

export const adminGetCouponSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Get coupon details by id (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['couponId'],
    properties: { couponId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { coupon: couponObject } },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};
