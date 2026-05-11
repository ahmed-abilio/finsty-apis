import type { FastifySchema } from 'fastify';

// ─── Shared error shapes ──────────────────────────────────────────────────────

const unauthorized = {
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

// ─── Reusable domain objects ──────────────────────────────────────────────────

const storeReviewImageObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    reviewId: { type: 'string', format: 'uuid' },
    imageUrl: { type: 'string', format: 'uri' },
    createdAt: { type: 'string', nullable: true },
  },
} as const;

const storeReviewObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    storeId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    rating: { type: 'number' },
    comment: { type: 'string', nullable: true },
    response: { type: 'string', nullable: true, description: 'Vendor / admin reply' },
    isApproved: { type: 'boolean' },
    isFlagged: { type: 'boolean' },
    flagReason: { type: 'string', nullable: true },
    images: { type: 'array', items: storeReviewImageObject },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const paginationMeta = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    page: { type: 'number' },
    limit: { type: 'number' },
    totalPages: { type: 'number' },
  },
} as const;

// ─── POST /stores/:storeId/reviews ────────────────────────────────────────────

export const submitStoreReviewSchema: FastifySchema = {
  tags: ['Store Reviews'],
  summary: 'Submit a store review',
  description: 'Authenticated users can leave one review per store. Optionally attach up to 5 image URLs.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['rating'],
    properties: {
      rating: { type: 'number', minimum: 1, maximum: 5, description: 'Star rating 1–5' },
      comment: { type: 'string', maxLength: 2000, description: 'Optional review text' },
      images: {
        type: 'array',
        maxItems: 5,
        items: { type: 'string', format: 'uri', description: 'S3 URL of a review photo' },
        description: 'Up to 5 review photo URLs',
      },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Review submitted',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { review: storeReviewObject } },
      },
    },
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
};

// ─── GET /stores/:storeId/reviews ────────────────────────────────────────────

export const listStoreReviewsSchema: FastifySchema = {
  tags: ['Store Reviews'],
  summary: 'List approved reviews for a store',
  description: 'Public paginated list of approved store reviews, newest first.',
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid' } },
  },
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      description: 'Paginated store review list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: storeReviewObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    404: notFound,
  },
};

// ─── PATCH /stores/:storeId/reviews/:reviewId/respond ────────────────────────

export const respondToStoreReviewSchema: FastifySchema = {
  tags: ['Store Reviews'],
  summary: 'Reply to a customer store review',
  description: 'Store owner (vendor) or admin can post a single public reply to a review.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['storeId', 'reviewId'],
    properties: {
      storeId: { type: 'string', format: 'uuid' },
      reviewId: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['response'],
    properties: {
      response: { type: 'string', minLength: 1, maxLength: 2000, description: 'Public reply text' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Response saved',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { review: storeReviewObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── GET /admin/store-reviews ─────────────────────────────────────────────────

export const adminListStoreReviewsSchema: FastifySchema = {
  tags: ['Admin — Store Reviews'],
  summary: 'List all store reviews (admin)',
  description: 'Admin endpoint to browse, filter, and moderate store reviews. Filter by `isFlagged=true` to see the moderation queue.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      storeId: { type: 'string', format: 'uuid', description: 'Filter to a specific store' },
      isFlagged: { type: 'boolean', description: 'Filter flagged reviews' },
      isApproved: { type: 'boolean', description: 'Filter by approval status' },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      description: 'Paginated store review list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: storeReviewObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
    403: forbidden,
  },
};

// ─── PATCH /admin/store-reviews/:reviewId/status ──────────────────────────────

export const setStoreReviewStatusSchema: FastifySchema = {
  tags: ['Admin — Store Reviews'],
  summary: 'Approve or hide a store review',
  description: 'Toggles `isApproved`. Setting to `false` hides the review from the public listing and excludes it from the store\'s rating aggregate.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['reviewId'],
    properties: { reviewId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['isApproved'],
    properties: {
      isApproved: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Status updated',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { review: storeReviewObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};
