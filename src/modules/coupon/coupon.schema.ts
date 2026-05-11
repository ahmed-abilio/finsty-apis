import { FastifySchema } from 'fastify';

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
    readyToUse: { type: 'boolean' },
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
  required: ['code', 'type', 'value', 'validFrom', 'validTo'],
  properties: {
    code: {
      type: 'string',
      minLength: 3,
      maxLength: 50,
      description: 'Unique coupon code (auto-uppercased)',
    },
    type: {
      type: 'string',
      enum: ['FLAT', 'PERCENTAGE', 'FREE_DELIVERY'],
      description: 'FLAT = fixed amount off, PERCENTAGE = % off subtotal, FREE_DELIVERY = waives delivery charge',
    },
    value: {
      type: 'number',
      exclusiveMinimum: 0,
      description: 'Amount (FLAT) or percentage (PERCENTAGE). Ignored for FREE_DELIVERY.',
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
    400: errorResponse,
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
    400: errorResponse,
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

// ─── GET /coupons/validate ─────────────────────────────────────────────────────

export const validateCouponSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Validate a coupon for the current cart',
  description:
    'Returns the computed discount amount for a coupon code against the given cart context. ' +
    'Does NOT redeem the coupon — redemption happens when the order is created.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    required: ['code', 'subtotal'],
    properties: {
      code: { type: 'string', description: 'Coupon code to validate' },
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
            coupon: couponObject,
            discountAmount: { type: 'number' },
          },
        },
      },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
  },
};

// ─── GET /coupons ─────────────────────────────────────────────────────────────

export const listCouponsSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'List approved coupons',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
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
  },
};
// ─── GET /coupons/my-coupons (vendor) ─────────────────────────────────────────

export const vendorListCouponsSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'List all coupons for the authenticated vendor\'s store',
  description:
    'Returns every coupon belonging to the vendor\'s store regardless of isActive or readyToUse status. ' +
    'Restricted to Vendor role.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
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

// ─── PATCH /admin/coupons/:couponId/ready-to-use ──────────────────────────────

export const toggleReadyToUseSchema: FastifySchema = {
  tags: ['Coupons'],
  summary: 'Toggle readyToUse flag for a coupon (admin only)',
  description:
    'Flips the readyToUse flag. Only coupons with readyToUse=true are visible to customers ' +
    'in public lists and can be applied at checkout.',
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
