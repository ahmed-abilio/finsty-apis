import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const orderServiceabilityBody = {
  type: 'object',
  required: [
    'pickup_latitude',
    'pickup_longitude',
    'drop_latitude',
    'drop_longitude',
    'paid',
    'order_value',
  ],
  properties: {
    pickup_latitude: {
      type: 'string',
      description: 'Pickup latitude. Shadowfax converts the string to a float.',
    },
    pickup_longitude: {
      type: 'string',
      description: 'Pickup longitude. Shadowfax converts the string to a float.',
    },
    drop_latitude: {
      type: 'string',
      description: 'Drop latitude. Shadowfax converts the string to a float.',
    },
    drop_longitude: {
      type: 'string',
      description: 'Drop longitude. Shadowfax converts the string to a float.',
    },
    paid: {
      type: 'string',
      enum: ['true', 'false'],
      description: '`false` for COD orders and `true` for prepaid orders.',
    },
    order_value: {
      type: ['string', 'number'],
      description: 'Order value passed to Shadowfax.',
    },
    COID: {
      type: 'string',
      description: 'Client order id used for merchant-side order mapping in Shadowfax.',
    },
    stage_of_check: {
      type: 'string',
      enum: ['pre_order', 'post_order'],
      description: 'Whether the serviceability check is pre-order or post-order.',
    },
    rain_flag: {
      type: 'boolean',
      description: 'Set to true when the order is rain impacted.',
    },
    client_surge: {
      type: 'number',
      description: 'Extra surge incentive offered to the rider.',
    },
  },
  additionalProperties: false,
} as const;

export const checkOrderServiceabilitySchema: FastifySchema = {
  tags: ['Shadowfax'],
  summary: 'Check Shadowfax order serviceability',
  description:
    'Proxies a Shadowfax order serviceability check for the given pickup and drop coordinates. ' +
    'Requires a valid JWT. Shadowfax credentials are applied server-side.',
  security: [{ BearerAuth: [] }],
  body: orderServiceabilityBody,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', additionalProperties: true },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    502: errorResponse,
  },
};
