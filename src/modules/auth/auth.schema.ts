import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

// ─── Body types ────────────────────────────────────────────────────────────────

export interface RefreshTokenBody {
  refreshToken: string;
  deviceToken?: string;
  platform?: 'ios' | 'android';
}

const deviceTokenProperties = {
  deviceToken: {
    type: 'string',
    minLength: 1,
    description: 'FCM registration token (optional; send with platform)',
  },
  platform: {
    type: 'string',
    enum: ['ios', 'android'],
    description: 'Device platform (required when deviceToken is sent)',
  },
} as const;

// ─── Shared shapes ─────────────────────────────────────────────────────────────

const idTokenBody = {
  type: 'object',
  required: ['idToken'],
  properties: {
    idToken: {
      type: 'string',
      minLength: 10,
      description: 'Firebase ID token obtained from the client SDK',
    },
    referralCode: {
      type: 'string',
      minLength: 6,
      maxLength: 20,
      description: 'Optional referral code from an existing user (only applied for new accounts)',
    },
    ...deviceTokenProperties,
  },
  additionalProperties: false,
} as const;

const phoneOtpBody = {
  type: 'object',
  required: ['phone', 'otp'],
  properties: {
    phone: {
      type: 'string',
      description: 'Phone number in E.164 format (e.g. +2348012345678)',
      pattern: '^\\+[1-9]\\d{6,14}$',
    },
    otp: {
      type: 'string',
      minLength: 4,
      maxLength: 6,
      description: 'OTP code received via SMS',
    },
    referralCode: {
      type: 'string',
      minLength: 6,
      maxLength: 20,
      description: 'Optional referral code from an existing user (only applied for new accounts)',
    },
    ...deviceTokenProperties,
  },
  additionalProperties: false,
} as const;

const authSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            firebaseUid: { type: 'string' },
            phone: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            profileImage: { type: 'string', nullable: true },
            role: { type: 'string' },
            provider: { type: 'string', enum: ['phone', 'google', 'apple'] },
            isActive: { type: 'boolean' },
            referralCode: { type: 'string' },
            referralAmount: { type: 'number' },
            referredById: { type: 'string', nullable: true },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
        store: {
          type: 'object',
          nullable: true,
          additionalProperties: true,
        },
        isStoreActive: { type: 'boolean' },
      },
    },
  },
} as const;

const unauthorizedResponse = {
  description: 'Invalid or expired Firebase ID token',
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
} as const;

// ─── Shared forbidden response ────────────────────────────────────────────────

const forbiddenResponse = {
  description: 'Access denied — insufficient role',
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
} as const;

// ─── POST /auth/send-otp ──────────────────────────────────────────────────────

export const sendOtpSchema: FastifySchema = {
  tags: ['Customer Auth'],
  summary: 'Send OTP to phone number',
  description:
    'Sends a one-time password to the given phone number. Currently uses a hardcoded OTP (1234) — a real SMS provider will be integrated later.',
  body: {
    type: 'object',
    required: ['phone'],
    properties: {
      phone: {
        type: 'string',
        description: 'Phone number in E.164 format (e.g. +2348012345678)',
        pattern: '^\\+[1-9]\\d{6,14}$',
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'OTP dispatched',
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
    500: {
      description: 'Failed to send OTP',
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
}
};

const pushTokenNote =
  ' Optionally include `deviceToken` and `platform` (`ios`|`android`) in this request to register for push notifications, ' +
  'or call `PUT /api/v1/users/me/device-token` after login / when the FCM token refreshes.';

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────

export const verifyOtpSchema: FastifySchema = {
  tags: ['Customer Auth'],
  summary: 'Verify OTP and authenticate',
  description:
    'Submit the phone number and the OTP received via SMS. Returns API access + refresh tokens on success.' +
    pushTokenNote,
  body: phoneOtpBody,
  response: {
    200: { description: 'Authenticated successfully (existing user)', ...authSuccessResponse },
    201: { description: 'Authenticated successfully (new user)', ...authSuccessResponse },
    400: validationErrorResponse,
    401: { ...unauthorizedResponse, description: 'Invalid or expired OTP' },
  },
};

// ─── POST /auth/google ────────────────────────────────────────────────────────

export const googleSignInSchema: FastifySchema = {
  tags: ['Auth'],
  summary: 'Authenticate via Google Sign-In (Firebase)',
  description:
    'Exchange a Firebase ID token (obtained after Google Sign-In on the client) for API tokens.',
  body: idTokenBody,
  response: {
    200: { description: 'Authenticated successfully', ...authSuccessResponse },
    400: validationErrorResponse,
    401: unauthorizedResponse,
  },
};

// ─── POST /auth/apple ─────────────────────────────────────────────────────────

export const appleSignInSchema: FastifySchema = {
  tags: ['Auth'],
  summary: 'Authenticate via Apple Sign-In (Firebase)',
  description:
    'Exchange a Firebase ID token (obtained after Apple Sign-In on the client) for API tokens.',
  body: idTokenBody,
  response: {
    200: { description: 'Authenticated successfully', ...authSuccessResponse },
    400: validationErrorResponse,
    401: unauthorizedResponse,
  },
};

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

export const refreshTokenSchema: FastifySchema = {
  tags: ['Auth'],
  summary: 'Refresh access token',
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string', minLength: 10 },
      ...deviceTokenProperties,
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
            accessToken: { type: 'string' },
          },
        },
      },
    },
    401: unauthorizedResponse,
  },
};

// ─── Shared OTP body (no referralCode for admin/vendor) ──────────────────────

const roleOtpSendBody = {
  type: 'object',
  required: ['phone'],
  properties: {
    phone: {
      type: 'string',
      description: 'Phone number in E.164 format (e.g. +2348012345678)',
      pattern: '^\\+[1-9]\\d{6,14}$',
    },
  },
  additionalProperties: false,
} as const;

const roleOtpVerifyBody = {
  type: 'object',
  required: ['phone', 'otp'],
  properties: {
    phone: {
      type: 'string',
      description: 'Phone number in E.164 format (e.g. +2348012345678)',
      pattern: '^\\+[1-9]\\d{6,14}$',
    },
    otp: {
      type: 'string',
      minLength: 4,
      maxLength: 6,
      description: 'OTP code received via SMS',
    },
    ...deviceTokenProperties,
  },
  additionalProperties: false,
} as const;

const otpSentResponse = {
  200: {
    description: 'OTP dispatched',
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
} as const;

// ─── POST /auth/admin/send-otp ────────────────────────────────────────────────

export const adminSendOtpSchema: FastifySchema = {
  tags: ['Admin Auth'],
  summary: 'Send OTP (admin login)',
  description: 'Sends a one-time password to the phone number. Only users with the admin role can complete the verify step.',
  body: roleOtpSendBody,
  response: otpSentResponse,
};

// ─── POST /auth/admin/verify-otp ─────────────────────────────────────────────

export const adminVerifyOtpSchema: FastifySchema = {
  tags: ['Admin Auth'],
  summary: 'Verify OTP and authenticate as admin',
  description:
    'Verifies the OTP and returns tokens. Returns 403 if the phone number does not belong to an admin account.' +
    pushTokenNote,
  body: roleOtpVerifyBody,
  response: {
    200: { description: 'Authenticated successfully', ...authSuccessResponse },
    201: { description: 'Authenticated successfully (new user)', ...authSuccessResponse },
    400: validationErrorResponse,
    401: { ...unauthorizedResponse, description: 'Invalid or expired OTP' },
    403: forbiddenResponse,
  },
};

// ─── POST /auth/vendor/send-otp ──────────────────────────────────────────────

export const vendorSendOtpSchema: FastifySchema = {
  tags: ['Vendor Auth'],
  summary: 'Send OTP (vendor login)',
  description:
    'Sends a one-time password to the phone number. Verify step creates a vendor account on first login if the phone is new.',
  body: roleOtpSendBody,
  response: otpSentResponse,
};

// ─── POST /auth/vendor/verify-otp ────────────────────────────────────────────

export const vendorVerifyOtpSchema: FastifySchema = {
  tags: ['Vendor Auth'],
  summary: 'Verify OTP and authenticate as vendor',
  description:
    'Verifies the OTP and returns tokens. Creates a new vendor user on first login (201). ' +
    'Response includes `user` (use `user.id` as `ownerId` for POST /stores) and `store` (null until onboarded).' +
    pushTokenNote,
  body: roleOtpVerifyBody,
  response: {
    200: { description: 'Authenticated successfully', ...authSuccessResponse },
    201: { description: 'Authenticated successfully (new user)', ...authSuccessResponse },
    400: validationErrorResponse,
    401: { ...unauthorizedResponse, description: 'Invalid or expired OTP' },
    403: forbiddenResponse,
  },
};

// ─── POST /auth/logout ────────────────────────────────────────────────────────

export const logoutSchema: FastifySchema = {
  tags: ['Auth'],
  summary: 'Logout — revoke refresh token',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' },
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
          properties: { message: { type: 'string' } },
        },
      },
    },
  },
};

// ─── GET /auth/validate-referral/:code ───────────────────────────────────────

export const validateReferralSchema: FastifySchema = {
  tags: ['Customer Auth'],
  summary: 'Validate a referral code',
  description: 'Checks if a referral code is valid and returns the referrer\'s name.',
  params: {
    type: 'object',
    required: ['code'],
    properties: {
      code: {
        type: 'string',
        minLength: 1,
        description: 'The referral code to validate',
      },
    },
  },
  response: {
    200: {
      description: 'Referral code is valid',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            name: { type: 'string', nullable: true },
          },
        },
      },
    },
    404: {
      description: 'Referral code is invalid',
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
