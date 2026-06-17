import { FastifySchema } from 'fastify';
import { validationErrorResponse } from '@utils/sharedSchemas';
import { CMS_AUDIENCE_TYPES } from './cms.types';

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const cmsPageObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    audienceType: { type: 'string', enum: [...CMS_AUDIENCE_TYPES] },
    contentHtml: { type: 'string' },
    isPublished: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const cmsListQuery = {
  type: 'object',
  properties: {
    slug: { type: 'string', minLength: 1, maxLength: 128 },
    type: { type: 'string', enum: [...CMS_AUDIENCE_TYPES] },
    isPublished: { type: 'boolean' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
  additionalProperties: false,
} as const;

const cmsReadQuery = {
  type: 'object',
  properties: {
    slug: { type: 'string', minLength: 1, maxLength: 128 },
    type: { type: 'string', enum: [...CMS_AUDIENCE_TYPES] },
  },
  additionalProperties: false,
} as const;

const createCmsBody = {
  type: 'object',
  required: ['slug', 'title', 'audienceType', 'contentHtml'],
  properties: {
    slug: { type: 'string', minLength: 2, maxLength: 128 },
    title: { type: 'string', minLength: 1, maxLength: 255 },
    audienceType: { type: 'string', enum: [...CMS_AUDIENCE_TYPES] },
    contentHtml: { type: 'string', maxLength: 500000 },
    isPublished: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const updateCmsBody = {
  type: 'object',
  properties: {
    slug: { type: 'string', minLength: 2, maxLength: 128 },
    title: { type: 'string', minLength: 1, maxLength: 255 },
    audienceType: { type: 'string', enum: [...CMS_AUDIENCE_TYPES] },
    contentHtml: { type: 'string', maxLength: 500000 },
    isPublished: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const cmsParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

// ─── Authenticated read ───────────────────────────────────────────────────────

export const listCmsPagesSchema: FastifySchema = {
  tags: ['CMS'],
  summary: 'List published CMS pages (authenticated)',
  description:
    'Returns published pages for the given audience. Filter by `slug` and/or `type` (`user`, `vendor`, `admin`, `all`). ' +
    'If `type` is omitted, uses the JWT role. Rows with `audienceType=all` are included.',
  security: [{ BearerAuth: [] }],
  querystring: cmsReadQuery,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: cmsPageObject },
          },
        },
      },
    },
    401: errorResponse,
  },
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminListCmsPagesSchema: FastifySchema = {
  tags: ['Admin CMS'],
  summary: 'List all CMS pages (admin)',
  security: [{ BearerAuth: [] }],
  querystring: cmsListQuery,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: cmsPageObject },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
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

export const adminGetCmsPageSchema: FastifySchema = {
  tags: ['Admin CMS'],
  summary: 'Get CMS page by id (admin)',
  security: [{ BearerAuth: [] }],
  params: cmsParams,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { page: cmsPageObject } },
      },
    },
    404: errorResponse,
  },
};

export const createCmsPageSchema: FastifySchema = {
  tags: ['Admin CMS'],
  summary: 'Create CMS page (admin)',
  security: [{ BearerAuth: [] }],
  body: createCmsBody,
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { page: cmsPageObject } },
      },
    },
    400: validationErrorResponse,
    409: errorResponse,
  },
};

export const updateCmsPageSchema: FastifySchema = {
  tags: ['Admin CMS'],
  summary: 'Update CMS page (admin)',
  security: [{ BearerAuth: [] }],
  params: cmsParams,
  body: updateCmsBody,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { page: cmsPageObject } },
      },
    },
    400: validationErrorResponse,
    404: errorResponse,
    409: errorResponse,
  },
};

export const deleteCmsPageSchema: FastifySchema = {
  tags: ['Admin CMS'],
  summary: 'Delete CMS page (admin)',
  security: [{ BearerAuth: [] }],
  params: cmsParams,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    404: errorResponse,
  },
};
