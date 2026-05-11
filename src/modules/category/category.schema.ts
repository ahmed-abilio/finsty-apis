import type { FastifySchema } from 'fastify';

// ─── Shared response shapes ───────────────────────────────────────────────────

const unauthorized = {
  type: 'object',
  description: 'Missing or invalid JWT',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const forbidden = {
  type: 'object',
  description: 'Authenticated but not an admin',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const notFound = {
  type: 'object',
  description: 'Category not found',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const conflict = {
  type: 'object',
  description: 'Category name already exists or is in use by products',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

// ─── Reusable domain object ───────────────────────────────────────────────────

const categoryObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

// ─── POST /categories ─────────────────────────────────────────────────────────

export const createCategorySchema: FastifySchema = {
  tags: ['Categories'],
  summary: 'Create a category',
  description: 'Admin-only. Creates a new product category with a unique name.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Category created',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { category: categoryObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    409: conflict,
  },
};

// ─── GET /categories ──────────────────────────────────────────────────────────

export const listCategoriesSchema: FastifySchema = {
  tags: ['Categories'],
  summary: 'List all categories',
  description: 'Public. Returns all categories. Pass `?activeOnly=true` to filter inactive ones.',
  querystring: {
    type: 'object',
    properties: {
      activeOnly: { type: 'boolean', default: false },
    },
  },
  response: {
    200: {
      description: 'List of categories',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { categories: { type: 'array', items: categoryObject } },
        },
      },
    },
  },
};

// ─── GET /categories/:categoryId ─────────────────────────────────────────────

export const getCategorySchema: FastifySchema = {
  tags: ['Categories'],
  summary: 'Get a category by ID',
  description: 'Public. Returns a single category.',
  params: {
    type: 'object',
    required: ['categoryId'],
    properties: {
      categoryId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Category detail',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { category: categoryObject } },
      },
    },
    404: notFound,
  },
};

// ─── PATCH /categories/:categoryId ───────────────────────────────────────────

export const updateCategorySchema: FastifySchema = {
  tags: ['Categories'],
  summary: 'Update a category',
  description: 'Admin-only. Partially updates a category.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['categoryId'],
    properties: {
      categoryId: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
      isActive: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Updated category',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { category: categoryObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
};

// ─── DELETE /categories/:categoryId ──────────────────────────────────────────

export const deleteCategorySchema: FastifySchema = {
  tags: ['Categories'],
  summary: 'Delete a category',
  description:
    'Admin-only. Hard-deletes a category. Fails with 409 if any product references it.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['categoryId'],
    properties: {
      categoryId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Category deleted',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
};
