import type { FastifySchema } from 'fastify';

const errorResponse = {
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

const adminUserSummary = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    role: { type: 'string', enum: ['user', 'vendor', 'admin'] },
    isActive: { type: 'boolean' },
    provider: { type: 'string' },
    profileImage: { type: 'string', nullable: true },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const paginationObject = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    page: { type: 'number' },
    limit: { type: 'number' },
    totalPages: { type: 'number' },
  },
} as const;

export const adminListUsersSchema: FastifySchema = {
  tags: ['Admin Users'],
  summary: 'List all platform users (admin only)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      role: { type: 'string', enum: ['user', 'vendor', 'admin'] },
      isActive: { type: 'boolean' },
      search: { type: 'string' },
      email: { type: 'string' },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
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
            users: { type: 'array', items: adminUserSummary },
            pagination: paginationObject,
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
};

export const adminGetUserSchema: FastifySchema = {
  tags: ['Admin Users'],
  summary: 'Get a user by ID (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { user: adminUserSummary },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};
