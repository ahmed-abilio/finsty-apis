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
  description: 'Sub-category or parent category not found',
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
  description: 'Sub-category name already exists in this category, or is in use by products',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

// ─── Reusable domain object ───────────────────────────────────────────────────

const subCategoryObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    categoryId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

// ─── POST /categories/:categoryId/sub-categories ──────────────────────────────

export const createSubCategorySchema: FastifySchema = {
  tags: ['Sub-Categories'],
  summary: 'Create a sub-category',
  description:
    'Admin-only. Creates a new sub-category under the specified parent category. ' +
    'Names must be unique within the same parent category.',
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
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Sub-category created',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { subCategory: subCategoryObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
};

// ─── GET /categories/:categoryId/sub-categories ───────────────────────────────

export const listSubCategoriesSchema: FastifySchema = {
  tags: ['Sub-Categories'],
  summary: 'List sub-categories for a category',
  description:
    'Public. Returns all sub-categories under the given parent category. ' +
    'Pass `?activeOnly=true` to exclude inactive ones.',
  params: {
    type: 'object',
    required: ['categoryId'],
    properties: {
      categoryId: { type: 'string', format: 'uuid' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      activeOnly: { type: 'boolean', default: false },
    },
  },
  response: {
    200: {
      description: 'List of sub-categories',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { subCategories: { type: 'array', items: subCategoryObject } },
        },
      },
    },
    404: notFound,
  },
};

// ─── GET /sub-categories/:subCategoryId ───────────────────────────────────────

export const getSubCategorySchema: FastifySchema = {
  tags: ['Sub-Categories'],
  summary: 'Get a sub-category by ID',
  description: 'Public. Returns a single sub-category.',
  params: {
    type: 'object',
    required: ['subCategoryId'],
    properties: {
      subCategoryId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Sub-category detail',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { subCategory: subCategoryObject } },
      },
    },
    404: notFound,
  },
};

// ─── PATCH /sub-categories/:subCategoryId ─────────────────────────────────────

export const updateSubCategorySchema: FastifySchema = {
  tags: ['Sub-Categories'],
  summary: 'Update a sub-category',
  description: 'Admin-only. Partially updates a sub-category.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['subCategoryId'],
    properties: {
      subCategoryId: { type: 'string', format: 'uuid' },
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
      description: 'Updated sub-category',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { subCategory: subCategoryObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
};

// ─── DELETE /sub-categories/:subCategoryId ────────────────────────────────────

export const deleteSubCategorySchema: FastifySchema = {
  tags: ['Sub-Categories'],
  summary: 'Delete a sub-category',
  description:
    'Admin-only. Hard-deletes a sub-category. Fails with 409 if any product references it.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['subCategoryId'],
    properties: {
      subCategoryId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Sub-category deleted',
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
