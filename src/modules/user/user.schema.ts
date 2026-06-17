import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

// ─── Shared object shape ───────────────────────────────────────────────────────

const userObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    firebaseUid: { type: 'string' },
    name: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    profileImage: { type: 'string', nullable: true },
    provider: { type: 'string', enum: ['phone', 'google', 'apple'] },
    role: { type: 'string' },
    isActive: { type: 'boolean' },
    ipAddress: { type: 'string', nullable: true, description: 'Last known IP address of the user (IPv4 or IPv6)' },
    referralCode: { type: 'string' },
    referralAmount: { type: 'number' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

// ─── GET /users/me ─────────────────────────────────────────────────────────────

export const getMeSchema: FastifySchema = {
  tags: ['User'],
  summary: 'Get current authenticated user',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      description: 'Current user profile',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { user: userObject },
        },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },
};

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

export const updateMeSchema: FastifySchema = {
  tags: ['User'],
  summary: 'Update current user profile',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, description: 'Display name of the user' },
      profileImage: { type: 'string', format: 'uri', description: 'S3 public URL of the profile picture' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Updated user',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { user: userObject },
        },
      },
    },
  },
};

// ─── DELETE /users/me ─────────────────────────────────────────────────────────

export const deleteMeSchema: FastifySchema = {
  tags: ['User'],
  summary: 'Deactivate current user account',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  },
};

// ─── PATCH /users/me/avatar ───────────────────────────────────────────────────

export const confirmAvatarSchema: FastifySchema = {
  tags: ['User'],
  summary: 'Set profile picture from uploaded S3 image',
  description:
    'After uploading an image via `GET /media/presigned-upload` + S3 PUT, ' +
    'send the `publicUrl` returned by the presigned-upload endpoint here to save it as the user\'s profile picture.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['profileImage'],
    properties: {
      profileImage: {
        type: 'string',
        format: 'uri',
        description: 'The `publicUrl` returned by GET /media/presigned-upload after a successful S3 upload.',
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Profile picture updated — returns updated user',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { user: userObject },
        },
      },
    },
    400: validationErrorResponse,
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: {
          type: 'object',
          properties: { code: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  },
};

// ─── PUT /users/me/device-token ───────────────────────────────────────────────

export const registerDeviceTokenSchema: FastifySchema = {
  tags: ['User'],
  summary: 'Register FCM device token for push notifications',
  description:
    'Upserts the Firebase Cloud Messaging token for the authenticated user (role from JWT). ' +
    'Call after login and whenever the FCM token refreshes. Requires the mobile app to request notification permission first.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['token', 'platform'],
    properties: {
      token: { type: 'string', minLength: 1, description: 'FCM registration token' },
      platform: { type: 'string', enum: ['ios', 'android'] },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Token registered',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
    400: validationErrorResponse,
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: {
          type: 'object',
          properties: { code: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  },
};
