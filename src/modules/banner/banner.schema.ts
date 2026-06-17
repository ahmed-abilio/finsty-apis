import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

// ─── Shared shapes ─────────────────────────────────────────────────────────────

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const priceBannerObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    imageUrl: { type: 'string' },
    priceThreshold: { type: 'number' },
    isActive: { type: 'boolean' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const storeDiscountBannerObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    storeId: { type: 'string' },
    title: { type: 'string' },
    imageUrl: { type: 'string' },
    discountPercentage: { type: 'number' },
    isActive: { type: 'boolean' },
    isApproved: { type: 'boolean' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

// ─── Price Banner schemas ──────────────────────────────────────────────────────

export const createPriceBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Create a price-threshold banner (admin only)',
  description:
    'Creates a banner with an image and a price threshold. ' +
    'On the storefront, clicking the banner returns all products priced under the threshold.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['title', 'imageUrl', 'priceThreshold'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120, description: 'Banner display title' },
      imageUrl: { type: 'string', minLength: 1, description: 'S3 public URL of the banner image' },
      priceThreshold: {
        type: 'number',
        exclusiveMinimum: 0,
        description: 'Products priced at or below this value are shown when the banner is clicked',
      },
      isActive: { type: 'boolean', description: 'Whether the banner is visible on the storefront' },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { banner: priceBannerObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
  },
};

export const updatePriceBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Update a price banner (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['bannerId'],
    properties: { bannerId: { type: 'string' } },
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120 },
      imageUrl: { type: 'string', minLength: 1 },
      priceThreshold: { type: 'number', exclusiveMinimum: 0 },
      isActive: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { banner: priceBannerObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

export const deletePriceBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Delete a price banner (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['bannerId'],
    properties: { bannerId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

export const adminListPriceBannersSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'List all price banners (admin only)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      isActive: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { banners: { type: 'array', items: priceBannerObject } } },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── Store Discount Banner schemas ─────────────────────────────────────────────

export const createStoreDiscountBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Create a store discount banner (admin only)',
  description:
    'Creates a store-level percentage discount banner. ' +
    'On the storefront, clicking the banner shows that store\'s products with the flat % discount applied.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['storeId', 'title', 'imageUrl', 'discountPercentage'],
    properties: {
      storeId: { type: 'string', description: 'UUID of the store this banner belongs to' },
      title: { type: 'string', minLength: 1, maxLength: 120, description: 'Banner display title' },
      imageUrl: { type: 'string', minLength: 1, description: 'S3 public URL of the banner image' },
      discountPercentage: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Flat percentage discount applied when the banner is clicked (1–100)',
      },
      isActive: { type: 'boolean', description: 'Whether the banner is visible on the storefront' },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { banner: storeDiscountBannerObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

export const updateStoreDiscountBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Update a store discount banner (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['bannerId'],
    properties: { bannerId: { type: 'string' } },
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120 },
      imageUrl: { type: 'string', minLength: 1 },
      discountPercentage: { type: 'number', minimum: 1, maximum: 100 },
      isActive: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { banner: storeDiscountBannerObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

export const approveStoreDiscountBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Approve a store discount banner (admin only)',
  description: 'Sets isApproved=true so the banner becomes visible on the storefront.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['bannerId'],
    properties: { bannerId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { banner: storeDiscountBannerObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

export const deleteStoreDiscountBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Delete a store discount banner (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['bannerId'],
    properties: { bannerId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

export const adminListStoreDiscountBannersSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'List all store discount banners (admin only)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      storeId: { type: 'string' },
      isActive: { type: 'boolean' },
      isApproved: { type: 'boolean' },
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
          properties: { banners: { type: 'array', items: storeDiscountBannerObject } },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── Vendor banner schemas ────────────────────────────────────────────────────

export const vendorCreateStoreDiscountBannerSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'Create a store discount banner (vendor)',
  description:
    'Vendors create a discount banner for their own store. ' +
    'The storeId is resolved automatically from the vendor\'s JWT — they cannot create banners for other stores. ' +
    'Banners created by vendors start as pending and require admin approval before appearing on the storefront.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['title', 'imageUrl', 'discountPercentage'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120, description: 'Banner display title' },
      imageUrl: { type: 'string', minLength: 1, description: 'S3 public URL of the banner image' },
      discountPercentage: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Flat percentage discount applied when the banner is clicked (1–100)',
      },
      isActive: { type: 'boolean', description: 'Whether the banner should be active once approved' },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { banner: storeDiscountBannerObject } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
  },
};

export const vendorListStoreDiscountBannersSchema: FastifySchema = {
  tags: ['Banners'],
  summary: "List the current vendor's store discount banners",
  description:
    'Returns all banners (approved and pending) belonging to the vendor\'s store.',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { banners: { type: 'array', items: storeDiscountBannerObject } },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── Public banner schema (storefront) ────────────────────────────────────────

export const listActiveBannersSchema: FastifySchema = {
  tags: ['Banners'],
  summary: 'List all active banners for the storefront',
  description:
    'Returns active price banners and approved + active store discount banners. ' +
    'Provide `lat`+`lng` to restrict store discount banners to stores within the GEOFENCE_RADIUS_KM radius. ' +
    'Price banners are always returned regardless of location.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      lat: { type: 'number', minimum: -90, maximum: 90, description: 'User latitude for geofence filtering of store discount banners' },
      lng: { type: 'number', minimum: -180, maximum: 180, description: 'User longitude for geofence filtering of store discount banners' },
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
            priceBanners: { type: 'array', items: priceBannerObject },
            storeDiscountBanners: { type: 'array', items: storeDiscountBannerObject },
          },
        },
      },
    },
    401: errorResponse,
  },
};
