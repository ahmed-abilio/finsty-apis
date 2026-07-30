import { FastifySchema } from 'fastify';

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

const badRequest = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const appConfigObject = {
  type: 'object',
  properties: {
    taxRate: {
      type: 'number',
      description: 'GST rate on merchandise subtotal (0–1, e.g. 0.18 = 18%)',
    },
    platformFee: {
      type: 'number',
      description: 'Fixed platform fee per order in INR',
    },
    geofenceRadiusKm: {
      type: 'number',
      description: 'Default store search / geofence radius in km',
    },
    referralRewardAmount: {
      type: 'number',
      description: 'Referral wallet credit in INR',
    },
    youtubeUrl: {
      type: 'string',
      description: 'Public YouTube / help video URL',
    },
    descriptions: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Human-readable descriptions per field',
    },
  },
} as const;

export const getAppConfigSchema: FastifySchema = {
  tags: ['Admin', 'Config'],
  operationId: 'getAdminAppConfig',
  summary: 'GET /admin/platform-settings/app-config',
  description:
    'Returns platform app configuration stored in `platform_settings` ' +
    '(tax rate, platform fee, geofence radius, referral reward, YouTube URL). ' +
    'Falls back to env vars when a key is missing.',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: appConfigObject,
      },
    },
    401: unauthorized,
    403: forbidden,
  },
};

export const patchAppConfigSchema: FastifySchema = {
  tags: ['Admin', 'Config'],
  operationId: 'patchAdminAppConfig',
  summary: 'PATCH /admin/platform-settings/app-config',
  description:
    'Partial update of platform app configuration. Only provided fields are updated. ' +
    '`taxRate` must be 0–1; fees/radius/referral must be ≥ 0; `youtubeUrl` empty or http(s) URL.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      taxRate: { type: 'number', minimum: 0, maximum: 1 },
      platformFee: { type: 'number', minimum: 0 },
      geofenceRadiusKm: { type: 'number', minimum: 0.1 },
      referralRewardAmount: { type: 'number', minimum: 0 },
      youtubeUrl: { type: 'string', maxLength: 2048 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: appConfigObject,
      },
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
  },
};

export const getPublicPlatformSettingsSchema: FastifySchema = {
  tags: ['Config'],
  operationId: 'getPublicPlatformSettings',
  summary: 'GET /platform-settings/public',
  description:
    'Public platform settings for mobile/apps: YouTube URL, referral reward amount, and geofence radius. ' +
    'Tax rate and platform fee are exposed via cart/checkout responses instead.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            youtubeUrl: { type: 'string' },
            referralRewardAmount: { type: 'number' },
            geofenceRadiusKm: { type: 'number' },
          },
        },
      },
    },
  },
};
