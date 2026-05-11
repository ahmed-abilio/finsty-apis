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

const reviewImageObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    reviewId: { type: 'string', format: 'uuid' },
    imageUrl: { type: 'string', format: 'uri' },
    createdAt: { type: 'string', nullable: true },
  },
} as const;

const reviewObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    rating: { type: 'number' },
    comment: { type: 'string', nullable: true },
    response: { type: 'string', nullable: true, description: 'Store / admin reply' },
    isApproved: { type: 'boolean' },
    isFlagged: { type: 'boolean' },
    flagReason: { type: 'string', nullable: true },
    images: { type: 'array', items: reviewImageObject },
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

// ─── POST /products/:productId/reviews ────────────────────────────────────────

export const submitReviewSchema: FastifySchema = {
  tags: ['Reviews'],
  summary: 'Submit a product review',
  description: 'Authenticated users can leave one review per product. Optionally attach up to 5 image URLs.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
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
        data: { type: 'object', properties: { review: reviewObject } },
      },
    },
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
};

// ─── GET /products/:productId/reviews ────────────────────────────────────────

export const listProductReviewsSchema: FastifySchema = {
  tags: ['Reviews'],
  summary: 'List approved reviews for a product',
  description: 'Public paginated list of approved reviews, newest first.',
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
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
      description: 'Paginated review list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: reviewObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    404: notFound,
  },
};

// ─── POST /reviews/:reviewId/flag ─────────────────────────────────────────────

export const flagReviewSchema: FastifySchema = {
  tags: ['Reviews'],
  summary: 'Flag a review as inappropriate',
  description: 'Authenticated users can report a review. Flagged reviews surface in the admin moderation queue.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['reviewId'],
    properties: { reviewId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string', maxLength: 500, description: 'Optional description of why the review is inappropriate' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Review flagged',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { review: reviewObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /admin/reviews ───────────────────────────────────────────────────────

export const adminListReviewsSchema: FastifySchema = {
  tags: ['Admin — Reviews'],
  summary: 'List all reviews (admin)',
  description: 'Admin endpoint to browse, filter, and moderate reviews. Filter by `isFlagged=true` to see the moderation queue.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      productId: { type: 'string', format: 'uuid', description: 'Filter to a specific product' },
      isFlagged: { type: 'boolean', description: 'Filter flagged reviews' },
      isApproved: { type: 'boolean', description: 'Filter by approval status' },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      description: 'Paginated review list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: reviewObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
    403: forbidden,
  },
};

// ─── PATCH /admin/reviews/:reviewId/respond ───────────────────────────────────

export const respondToReviewSchema: FastifySchema = {
  tags: ['Admin — Reviews'],
  summary: 'Reply to a customer review',
  description: 'Store owner or admin can post a single public reply to a review.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['reviewId'],
    properties: { reviewId: { type: 'string', format: 'uuid' } },
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
        data: { type: 'object', properties: { review: reviewObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── PATCH /admin/reviews/:reviewId/status ────────────────────────────────────

export const setReviewStatusSchema: FastifySchema = {
  tags: ['Admin — Reviews'],
  summary: 'Approve or hide a review',
  description: 'Toggles `isApproved`. Setting to `false` hides the review from public listing and excludes it from the rating aggregate.',
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
        data: { type: 'object', properties: { review: reviewObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};
