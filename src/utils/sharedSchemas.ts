/**
 * Shared response schemas for common error envelopes.
 *
 * Centralizing these prevents per-module duplication and ensures Fastify's
 * response serializer does not strip out fields (e.g. `details` on validation
 * errors) that `formatError` attaches to the response body.
 */

const validationIssueItemSchema = {
  type: 'object',
  properties: {
    field: { type: 'string' },
    message: { type: 'string' },
    keyword: { type: 'string' },
    params: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
} as const;

/** 400 envelope used by formatError — details may be a validation array or an object (e.g. AMOUNT_MISMATCH). */
export const validationErrorResponse = {
  description: 'Client error (validation or operational)',
  type: 'object',
  additionalProperties: true,
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      additionalProperties: true,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
        details: {
          description:
            'AJV validation issues (array) or operational context e.g. AMOUNT_MISMATCH (object).',
          oneOf: [
            {
              type: 'array',
              items: validationIssueItemSchema,
            },
            {
              type: 'object',
              additionalProperties: true,
            },
          ],
        },
        stack: { type: 'string' },
      },
    },
  },
} as const;

export const unauthorizedResponse = {
  description: 'Unauthorized',
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
      },
    },
  },
} as const;

export const forbiddenResponse = {
  description: 'Forbidden — insufficient permissions',
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
      },
    },
  },
} as const;

export const notFoundResponse = {
  description: 'Resource not found',
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
      },
    },
  },
} as const;
