import { FastifySchema } from 'fastify';

const unauthorized = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const notFound = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const conflict = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const forbidden = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const brandObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    storeId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
    logoUrl: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] },
  },
} as const;

const paginationMeta = {
  total: { type: 'number' },
  page: { type: 'number' },
  limit: { type: 'number' },
  totalPages: { type: 'number' },
} as const;

const storeIdParam = {
  type: 'object',
  required: ['storeId'],
  properties: { storeId: { type: 'string', format: 'uuid' } },
} as const;

const brandIdParam = {
  type: 'object',
  required: ['storeId', 'brandId'],
  properties: {
    storeId: { type: 'string', format: 'uuid' },
    brandId: { type: 'string', format: 'uuid' },
  },
} as const;

// ─── GET /stores/:storeId/brands ──────────────────────────────────────────────

export const listStoreBrandsSchema: FastifySchema = {
  tags: ['Brands'],
  summary: 'List brands for a store',
  security: [{ BearerAuth: [] }],
  params: storeIdParam,
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page:   { type: 'number', minimum: 1, default: 1 },
      limit:  { type: 'number', minimum: 1, maximum: 200, default: 20 },
      search: { type: 'string', maxLength: 100 },
      status: { type: 'string', enum: ['active', 'inactive', 'all'], default: 'all' },
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
            brands: { type: 'array', items: brandObject },
            ...paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
    403: forbidden,
  },
};

// ─── POST /stores/:storeId/brands ─────────────────────────────────────────────

export const createStoreBrandSchema: FastifySchema = {
  tags: ['Brands'],
  summary: 'Create a brand for a store',
  security: [{ BearerAuth: [] }],
  params: storeIdParam,
  body: {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      name:     { type: 'string', minLength: 1, maxLength: 255 },
      logoUrl:  { type: 'string', maxLength: 2048 },
      isActive: { type: 'boolean', default: true },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { brand: brandObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    409: conflict,
  },
};

// ─── PATCH /stores/:storeId/brands/:brandId ───────────────────────────────────

export const updateStoreBrandSchema: FastifySchema = {
  tags: ['Brands'],
  summary: 'Update a store brand',
  security: [{ BearerAuth: [] }],
  params: brandIdParam,
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name:     { type: 'string', minLength: 1, maxLength: 255 },
      logoUrl:  { type: 'string', maxLength: 2048 },
      isActive: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { brand: brandObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
};

// ─── DELETE /stores/:storeId/brands/:brandId ──────────────────────────────────

export const deleteStoreBrandSchema: FastifySchema = {
  tags: ['Brands'],
  summary: 'Toggle brand active status',
  security: [{ BearerAuth: [] }],
  params: brandIdParam,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { brand: brandObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};
