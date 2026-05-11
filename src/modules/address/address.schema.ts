import { FastifySchema } from 'fastify';

const addressObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    label: { type: 'string', enum: ['home', 'hotel', 'work', 'others'], nullable: true },
    receiverName: { type: 'string' },
    receiverPhone: { type: 'string' },
    line1: { type: 'string' },
    line2: { type: 'string', nullable: true },
    city: { type: 'string' },
    state: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    latitude: { type: ['number', 'null'] },
    longitude: { type: ['number', 'null'] },
    isDefault: { type: 'boolean' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const addressBody = {
  type: 'object',
  required: ['receiverName', 'receiverPhone', 'line1', 'city', 'state', 'postalCode'],
  properties: {
      label: { type: 'string', enum: ['home', 'hotel', 'work', 'others'], nullable: true },
    receiverName: { type: 'string', minLength: 1, maxLength: 100 },
    receiverPhone: { type: 'string', minLength: 1, maxLength: 20 },
    line1: { type: 'string', minLength: 1, maxLength: 255 },
    line2: { type: 'string', maxLength: 255 },
    city: { type: 'string', minLength: 1, maxLength: 100 },
    state: { type: 'string', minLength: 1, maxLength: 100 },
    postalCode: { type: 'string', minLength: 1, maxLength: 20 },
    country: { type: 'string', maxLength: 100, default: 'India' },
    latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Latitude of the address' },
    longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Longitude of the address' },
    isDefault: { type: 'boolean', default: false },
  },
  additionalProperties: false,
} as const;

const unauthorized = {
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

// ─── GET /addresses ────────────────────────────────────────────────────────────

export const listAddressesSchema: FastifySchema = {
  tags: ['Addresses'],
  summary: 'List all addresses for the authenticated user',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { addresses: { type: 'array', items: addressObject } },
        },
      },
    },
    401: unauthorized,
  },
};

// ─── POST /addresses ───────────────────────────────────────────────────────────

export const createAddressSchema: FastifySchema = {
  tags: ['Addresses'],
  summary: 'Add a new address',
  security: [{ BearerAuth: [] }],
  body: addressBody,
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { address: addressObject } },
      },
    },
    400: notFound,
    401: unauthorized,
  },
};

// ─── PATCH /addresses/:addressId ───────────────────────────────────────────────

export const updateAddressSchema: FastifySchema = {
  tags: ['Addresses'],
  summary: 'Update an address',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['addressId'],
    properties: { addressId: { type: 'string' } },
  },
  body: {
    type: 'object',
    properties: {
      label: { type: 'string', enum: ['home', 'hotel', 'work', 'others'], nullable: true },
      receiverName: { type: 'string', minLength: 1, maxLength: 100 },
      receiverPhone: { type: 'string', minLength: 1, maxLength: 20 },
      line1: { type: 'string', minLength: 1, maxLength: 255 },
      line2: { type: 'string', maxLength: 255 },
      city: { type: 'string', minLength: 1, maxLength: 100 },
      state: { type: 'string', minLength: 1, maxLength: 100 },
      postalCode: { type: 'string', minLength: 1, maxLength: 20 },
      country: { type: 'string', maxLength: 100 },
      latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Latitude of the address' },
      longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Longitude of the address' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { address: addressObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── DELETE /addresses/:addressId ──────────────────────────────────────────────

export const deleteAddressSchema: FastifySchema = {
  tags: ['Addresses'],
  summary: 'Delete an address',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['addressId'],
    properties: { addressId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── PATCH /addresses/:addressId/default ───────────────────────────────────────

export const setDefaultAddressSchema: FastifySchema = {
  tags: ['Addresses'],
  summary: 'Set an address as the default',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['addressId'],
    properties: { addressId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { address: addressObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};
