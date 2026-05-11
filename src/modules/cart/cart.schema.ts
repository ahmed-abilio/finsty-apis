import { FastifySchema } from 'fastify';

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
    unitPrice: { type: 'number' },
    itemTotal: { type: 'number' },
    product: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        brand: { type: 'string', nullable: true },
        basePrice: { type: 'number' },
        discountPercent: { type: 'number' },
        finalPrice: { type: 'number' },
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
          },
        },
      },
    },
    variant: {
      nullable: true,
      type: 'object',
      properties: {
        id: { type: 'string' },
        size: { type: 'string', nullable: true },
        color: { type: 'string', nullable: true },
        colorHex: { type: 'string', nullable: true },
        additionalPrice: { type: 'number' },
        label: { type: 'string' },
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
        itemCount: { type: 'number' },
        totalItems: { type: 'number' },
        pagination: paginationObject,
      },
    },
  },
} as const;

// ─── GET /cart ────────────────────────────────────────────────────────────────

export const getCartSchema: FastifySchema = {
  tags: ['Cart'],
  summary: 'Get current cart',
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
    400: unauthorized,
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
