import { FastifySchema } from 'fastify';
import { validationErrorResponse } from '@utils/sharedSchemas';

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

const conflict = {
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

const orderRefParam = {
  type: 'string',
  description: 'Order reference: Finsty UUID or public FI order code.',
} as const;

const returnItemObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    orderReturnId: { type: 'string', format: 'uuid' },
    orderItemId: { type: 'string', format: 'uuid' },
    quantity: { type: 'integer' },
    unitPrice: { type: 'number' },
    refundAmount: { type: 'number' },
  },
} as const;

const returnObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    orderId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    storeId: { type: 'string', format: 'uuid' },
    status: { type: 'string' },
    logisticsStatus: { type: ['string', 'null'] },
    reason: { type: ['string', 'null'] },
    rejectionReason: { type: ['string', 'null'] },
    refundAmount: { type: ['number', 'null'] },
    shadowfaxOrderId: { type: ['string', 'null'] },
    shadowfaxTrackingUrl: { type: ['string', 'null'] },
    riderId: { type: ['integer', 'null'] },
    riderName: { type: ['string', 'null'] },
    riderPhone: { type: ['string', 'null'] },
    requestedAt: { type: 'string', format: 'date-time' },
    receivedAtStoreAt: { type: ['string', 'null'], format: 'date-time' },
    inspectedAt: { type: ['string', 'null'], format: 'date-time' },
    refundProcessedAt: { type: ['string', 'null'], format: 'date-time' },
    items: { type: 'array', items: returnItemObject },
  },
} as const;

export const createOrderReturnSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Request order return (buyer)',
  description:
    'Creates a return request within 1 hour of delivery. Supports partial returns by line item. ' +
    'Schedules Shadowfax reverse pickup (customer → store).',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: orderRefParam },
  },
  body: {
    type: 'object',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['orderItemId', 'quantity'],
          properties: {
            orderItemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1 },
          },
          additionalProperties: false,
        },
      },
      reason: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { return: returnObject } },
      },
    },
    400: validationErrorResponse,
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
};

export const listOrderReturnsSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'List returns for an order',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: orderRefParam },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { returns: { type: 'array', items: returnObject } } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

export const getOrderReturnSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Get return detail',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId', 'returnId'],
    properties: {
      orderId: orderRefParam,
      returnId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { return: returnObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

export const getOrderReturnDeliveryStatusSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Poll Shadowfax return pickup status',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId', 'returnId'],
    properties: {
      orderId: orderRefParam,
      returnId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', additionalProperties: true },
      },
    },
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
};

export const listVendorReturnsSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'List store returns (vendor)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            returns: { type: 'array', items: returnObject },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    401: unauthorized,
    403: notFound,
  },
};

export const approveVendorReturnSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Approve return and refund buyer wallet (vendor)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['returnId'],
    properties: { returnId: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { return: returnObject } },
      },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
};

export const rejectVendorReturnSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Reject return after inspection (vendor)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['returnId'],
    properties: { returnId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { return: returnObject } },
      },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
  },
};
