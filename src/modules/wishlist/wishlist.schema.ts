import { FastifySchema } from 'fastify';

const unauthorized = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const wishlistItemObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    addedAt: { type: 'string', nullable: true },
    product: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        storeId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        brand: { type: 'string', nullable: true },
        gender: { type: 'string', nullable: true },
        categoryType: { type: 'string', nullable: true },
        basePrice: { type: 'number' },
        discountPercent: { type: 'number' },
        finalPrice: { type: 'number' },
        isActive: { type: 'boolean' },
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
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              size: { type: 'string', nullable: true },
              color: { type: 'string', nullable: true },
              colorHex: { type: 'string', nullable: true },
              additionalPrice: { type: 'number' },
              stock: { type: 'number' },
              label: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

const wishlistResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'array', items: wishlistItemObject },
  },
} as const;

// ─── GET /wishlist ────────────────────────────────────────────────────────────

export const getWishlistSchema: FastifySchema = {
  tags: ['Wishlist'],
  summary: 'Get current user wishlist',
  security: [{ BearerAuth: [] }],
  response: { 200: wishlistResponse, 401: unauthorized },
};

// ─── POST /wishlist ───────────────────────────────────────────────────────────

export const addToWishlistSchema: FastifySchema = {
  tags: ['Wishlist'],
  summary: 'Add a product to the wishlist',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['productId'],
    properties: {
      productId: { type: 'string', description: 'Product UUID' },
    },
    additionalProperties: false,
  },
  response: {
    201: wishlistResponse,
    400: unauthorized,
    401: unauthorized,
    404: unauthorized,
  },
};

// ─── DELETE /wishlist/:productId ──────────────────────────────────────────────

export const removeFromWishlistSchema: FastifySchema = {
  tags: ['Wishlist'],
  summary: 'Remove a product from the wishlist',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', description: 'Product UUID' } },
  },
  response: { 200: wishlistResponse, 401: unauthorized, 404: unauthorized },
};

// ─── POST /wishlist/:productId/toggle ─────────────────────────────────────────

export const toggleWishlistSchema: FastifySchema = {
  tags: ['Wishlist'],
  summary: 'Toggle product in wishlist (add if absent, remove if present)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', description: 'Product UUID' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            wishlisted: { type: 'boolean' },
            wishlist: { type: 'array', items: wishlistItemObject },
          },
        },
      },
    },
    401: unauthorized,
    404: unauthorized,
  },
};
