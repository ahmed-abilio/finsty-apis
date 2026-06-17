import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

// ─── POST /otp/send-phone ─────────────────────────────────────────────────────

export const sendPhoneOtpSchema: FastifySchema = {
  tags: ['OTP'],
  summary: 'Send OTP to a phone number',
  description:
    'Generates and sends a 6-digit OTP to the given phone. ' +
    'OTP expires in 10 minutes. Call `POST /otp/verify-phone` to verify.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['phone'],
    properties: {
      phone: { type: 'string', minLength: 1, maxLength: 20 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── POST /otp/verify-phone ───────────────────────────────────────────────────

export const verifyPhoneOtpSchema: FastifySchema = {
  tags: ['OTP'],
  summary: 'Verify a phone OTP',
  description:
    'Validates the OTP sent to the phone number and marks it as verified for 10 minutes. ' +
    'The verified flag is consumed by endpoints that require phone confirmation (e.g. store creation).',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['phone', 'otp'],
    properties: {
      phone: { type: 'string', minLength: 1, maxLength: 20 },
      otp: { type: 'string', minLength: 4, maxLength: 6 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { verified: { type: 'boolean' } } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── POST /otp/send-email ─────────────────────────────────────────────────────

export const sendEmailOtpSchema: FastifySchema = {
  tags: ['OTP'],
  summary: 'Send OTP to an email address',
  description:
    'Generates and sends a 6-digit OTP to the given email. ' +
    'OTP expires in 10 minutes. Call `POST /otp/verify-email` to verify.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
  },
};

// ─── POST /otp/verify-email ───────────────────────────────────────────────────

export const verifyEmailOtpSchema: FastifySchema = {
  tags: ['OTP'],
  summary: 'Verify an email OTP',
  description:
    'Validates the OTP sent to the email address and marks it as verified for 10 minutes. ' +
    'The verified flag is consumed by endpoints that require email confirmation (e.g. store creation).',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['email', 'otp'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      otp: { type: 'string', minLength: 4, maxLength: 6 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { verified: { type: 'boolean' } } },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
  },
};
