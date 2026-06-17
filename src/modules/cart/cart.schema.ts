import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

const unauthorized = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const cartItemObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    variantId: { type: 'string', nullable: true },
    quantity: { type: 'number' },
    isSelected: { type: 'boolean' },
    basePrice: {
      type: 'number',
      description: 'Raw product base price (per unit, before discount and variant adjustment).',
    },
    discountPercent: {
      type: 'number',
      description: 'Effective discount percent. 0 when outside the product\'s discount window.',
    },
    discountStartDate: {
      type: 'string',
      nullable: true,
      format: 'date-time',
      description: 'Product discount valid from (ISO 8601). Null if no start bound.',
    },
    discountEndDate: {
      type: 'string',
      nullable: true,
      format: 'date-time',
      description: 'Product discount valid until (ISO 8601). Null if no end bound.',
    },
    discountAmount: {
      type: 'number',
      description:
        'Per-unit monetary savings from the product discount when the window is active. ' +
        'The discount applies to the combined list line `(basePrice + additionalPrice)` per unit, ' +
        'not to base alone.',
    },
    discountedBasePrice: {
      type: 'number',
      description:
        'Per-unit catalogue base after applying the same `discountPercent` as used for the line. ' +
        'The variant surcharge after discount is implied in `unitPrice` (see `additionalPrice` for the pre-discount variant add-on).',
    },
    additionalPrice: {
      type: 'number',
      description:
        'Variant.additionalPrice per unit before discount (0 when the line has no variant). ' +
        'When a discount applies, the same percent reduces this portion as well as the base.',
    },
    unitPrice: {
      type: 'number',
      description:
        'Authoritative per-unit price for this cart line after discount: ' +
        'discounted base plus discounted variant additional (same percent on both). ' +
        'Always use this field (not `product.finalPrice`) when displaying or summing the cart.',
    },
    itemTotal: {
      type: 'number',
      description: 'Line total: `unitPrice * quantity`. Sum across selected items equals the cart `subtotal`.',
    },
    baseTotal: {
      type: 'number',
      description: 'basePrice * quantity (true pre-discount, pre-variant total).',
    },
    product: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        brand: { type: 'string', nullable: true },
        basePrice: { type: 'number' },
        discountPercent: { type: 'number' },
        discountStartDate: {
          type: 'string',
          nullable: true,
          format: 'date-time',
          description: 'Discount valid from (ISO 8601). Null if no start bound.',
        },
        discountEndDate: {
          type: 'string',
          nullable: true,
          format: 'date-time',
          description: 'Discount valid until (ISO 8601). Null if no end bound.',
        },
        finalPrice: {
          type: 'number',
          description:
            'Product-level discounted price (`basePrice * (1 - discountPercent/100)`). ' +
            'Does NOT include the selected variant\'s `additionalPrice`. ' +
            'For the actual per-unit cart charge use the line item\'s `unitPrice` instead.',
        },
        inStock: { type: 'boolean' },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              url: { type: 'string' },
              position: { type: 'number' },
            },
          },
        },
        store: {
          nullable: true,
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            latitude: { type: 'number', description: 'Store location latitude (WGS84).' },
            longitude: { type: 'number', description: 'Store location longitude (WGS84).' },
          },
        },
        category: {
          nullable: true,
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        subcategory: {
          nullable: true,
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    variant: {
      nullable: true,
      type: 'object',
      description: 'Selected product variant when the cart line item has a size or SKU.',
      properties: {
        id: { type: 'string', format: 'uuid' },
        productId: { type: 'string', format: 'uuid' },
        colorId: { type: 'string', format: 'uuid' },
        size: { type: 'string', nullable: true },
        sku: { type: 'string', nullable: true },
        stock: { type: 'number' },
        color: {
          type: 'string',
          nullable: true,
          description: 'Display name of the variant color.',
        },
        colorHex: {
          type: 'string',
          nullable: true,
          description: 'Hex code of the variant color.',
        },
        additionalPrice: { type: 'number' },
        label: { type: 'string' },
        imageUrl: {
          type: 'string',
          nullable: true,
          format: 'uri',
          description:
            'Resolved image URL for this line: first colour image for the variant, otherwise the first product image.',
        },
        image: {
          type: 'object',
          nullable: true,
          description: 'First colour image record when the variant has colour images; null when only product-level fallback applies.',
          properties: {
            id: { type: 'string' },
            colorId: { type: 'string' },
            imageUrl: { type: 'string', format: 'uri' },
            altText: { type: 'string', nullable: true },
            displayOrder: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        createdAt: { type: 'string', format: 'date-time', nullable: true },
        updatedAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  },
} as const;

const paginationObject = {
  type: 'object',
  properties: {
    page: { type: 'number' },
    limit: { type: 'number' },
    total: { type: 'number' },
    totalPages: { type: 'number' },
    hasNextPage: { type: 'boolean' },
  },
} as const;

const cartResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: cartItemObject },
        subtotal: { type: 'number' },
        taxRate: {
          type: 'number',
          description: 'Effective GST rate on merchandise subtotal (same as env `TAX_RATE`, e.g. 0.18 for 18%).',
        },
        taxAmount: {
          type: 'number',
          description: 'GST on the selected-items merchandise subtotal (rate from `TAX_RATE`).',
        },
        platformFee: {
          type: 'number',
          description: 'Fixed platform fee per order in INR from `PLATFORM_FEE` (same value used at checkout).',
        },
        itemCount: { type: 'number' },
        totalItems: { type: 'number' },
        pagination: paginationObject,
      },
    },
  },
} as const;

// ─── GET /cart ────────────────────────────────────────────────────────────────

const deliveryQuoteObject = {
  type: 'object',
  properties: {
    addressId: { type: 'string', format: 'uuid' },
    serviceable: { type: 'boolean' },
    quotedDeliveryCharge: {
      type: 'number',
      description: 'Live Shadowfax delivery fee for the default (or given) address.',
    },
    deliveryChargeApplied: {
      type: 'number',
      description: 'Fee included in estimatedPayableTotal (0 when free delivery applies).',
    },
    deliveryFeeWaived: {
      type: 'boolean',
      description: 'True when a FREE_DELIVERY coupon waives the fee (quote endpoint only).',
    },
    deliveryConfig: {
      type: 'object',
      additionalProperties: true,
    },
    subtotal: { type: 'number' },
    taxAmount: { type: 'number' },
    platformFee: { type: 'number' },
    estimatedPayableTotal: {
      type: 'number',
      description: 'subtotal + tax + platform + deliveryChargeApplied (matches order total before coupons).',
    },
  },
} as const;

export const getCartDeliveryQuoteSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Get Shadowfax delivery quote for checkout',
  description:
    'Uses the user default address (or optional `addressId`) and **selected** cart items from a single store. ' +
    'Calls Shadowfax order serviceability server-side. Use `quotedDeliveryCharge` for display and `deliveryChargeApplied` / `estimatedPayableTotal` for payment.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      addressId: {
        type: 'string',
        format: 'uuid',
        description: 'Override default address for the quote.',
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
            deliveryQuote: deliveryQuoteObject,
          },
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorized,
    404: unauthorized,
  },
};

export const getCartSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Get current cart',
  description:
    'Returns the authenticated user cart with product, store, category, subcategory, and variant details. ' +
    'Each variant includes colour name and hex when available, plus `imageUrl` / `image` for the variant display photo.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1, description: 'Page number' },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Items per page' },
      storeId: { type: 'string', description: 'Filter items by store ID' },
    },
    additionalProperties: false,
  },
  response: { 200: cartResponse, 401: unauthorized },
};

// ─── POST /cart/items ─────────────────────────────────────────────────────────

export const addCartItemSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Add a product to the cart',
  description: 'If the same product+variant is already in the cart, the quantity is incremented.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['productId', 'quantity'],
    properties: {
      productId: { type: 'string', description: 'Product UUID' },
      variantId: { type: 'string', description: 'Variant UUID (required if product has variants)' },
      quantity: { type: 'integer', minimum: 1, maximum: 100 },
    },
    additionalProperties: false,
  },
  response: {
    200: cartResponse,
    400: validationErrorResponse,
    401: unauthorized,
    404: unauthorized,
  },
};

// ─── PATCH /cart/items/:itemId ────────────────────────────────────────────────

export const updateCartItemSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Update cart item quantity',
  description: 'Set quantity to 0 to remove the item.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['itemId'],
    properties: { itemId: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['quantity'],
    properties: {
      quantity: { type: 'integer', minimum: 0, maximum: 100 },
    },
    additionalProperties: false,
  },
  response: { 200: cartResponse, 401: unauthorized, 404: unauthorized },
};

// ─── DELETE /cart/items/:itemId ───────────────────────────────────────────────

export const removeCartItemSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Remove an item from the cart',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['itemId'],
    properties: { itemId: { type: 'string' } },
  },
  response: { 200: cartResponse, 401: unauthorized, 404: unauthorized },
};

// ─── DELETE /cart ─────────────────────────────────────────────────────────────

export const clearCartSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Clear all items from the cart',
  security: [{ BearerAuth: [] }],
  response: { 200: cartResponse, 401: unauthorized },
};

// ─── PATCH /cart/items/:itemId/select ─────────────────────────────────────────

export const selectCartItemSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Select or deselect a cart item for checkout',
  description: 'Only selected items are included when creating an order. Newly added items are selected by default.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['itemId'],
    properties: { itemId: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['isSelected'],
    properties: {
      isSelected: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: { 200: cartResponse, 401: unauthorized, 404: unauthorized },
};
