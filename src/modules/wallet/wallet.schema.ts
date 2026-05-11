import { FastifySchema } from 'fastify';

const unauthorized = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const errorResponse = unauthorized;

const walletObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    balance: { type: 'number' },
    currency: { type: 'string' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const transactionObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    walletId: { type: 'string' },
    reference: { type: 'string' },
    type: { type: 'string', enum: ['credit', 'debit'] },
    amount: { type: 'number' },
    fee: { type: 'number' },
    balanceBefore: { type: 'number' },
    balanceAfter: { type: 'number' },
    status: { type: 'string', enum: ['pending', 'successful', 'failed'] },
    source: {
      type: 'string',
      enum: ['topup', 'order_payment', 'refund', 'withdrawal', 'bonus'],
    },
    provider: { type: 'string', nullable: true },
    providerReference: { type: 'string', nullable: true },
    metadata: { type: 'object', nullable: true, additionalProperties: true },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

// ─── GET /wallet ──────────────────────────────────────────────────────────────

export const getWalletSchema: FastifySchema = {
  tags: ['Wallet'],
  summary: 'Get my wallet',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { wallet: walletObject } },
      },
    },
    401: unauthorized,
    404: errorResponse,
  },
};

// ─── GET /wallet/transactions ─────────────────────────────────────────────────

export const listTransactionsSchema: FastifySchema = {
  tags: ['Wallet'],
  summary: 'List my wallet transactions',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
      type: { type: 'string', enum: ['credit', 'debit'] },
      source: {
        type: 'string',
        enum: ['topup', 'order_payment', 'refund', 'withdrawal', 'bonus'],
      },
      status: { type: 'string', enum: ['pending', 'successful', 'failed'] },
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
            transactions: { type: 'array', items: transactionObject },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    401: unauthorized,
  },
};

// ─── GET /wallet/transactions/:reference ──────────────────────────────────────

export const getTransactionSchema: FastifySchema = {
  tags: ['Wallet'],
  summary: 'Get a single transaction by reference',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['reference'],
    properties: { reference: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { transaction: transactionObject } },
      },
    },
    401: unauthorized,
    404: errorResponse,
  },
};

// ─── POST /wallet/topup/initiate ──────────────────────────────────────────────

export const initiateTopupSchema: FastifySchema = {
  tags: ['Wallet'],
  summary: 'Initiate a wallet top-up',
  description:
    'Creates a pending transaction and returns the payment provider checkout URL. ' +
    'After payment, call `/topup/verify` to credit the wallet.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['amount', 'reference'],
    properties: {
      amount: { type: 'number', minimum: 1 },
      reference: { type: 'string', minLength: 1 },
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
            reference: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            provider: { type: 'string' },
            checkout_url: { type: 'string' },
            provider_reference: { type: 'string' },
          },
        },
      },
    },
    400: errorResponse,
    401: unauthorized,
  },
};

// ─── POST /wallet/topup/verify ────────────────────────────────────────────────

export const verifyTopupSchema: FastifySchema = {
  tags: ['Wallet'],
  summary: 'Verify top-up and credit wallet',
  description: 'Idempotent — safe to call multiple times with the same reference.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['reference', 'providerReference'],
    properties: {
      reference: { type: 'string', minLength: 1 },
      providerReference: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { transaction: transactionObject } },
      },
    },
    400: errorResponse,
    401: unauthorized,
    404: errorResponse,
  },
};

// ─── POST /wallet/pay ─────────────────────────────────────────────────────────

export const paySchema: FastifySchema = {
  tags: ['Wallet'],
  summary: 'Debit wallet to pay for an order',
  description: 'Idempotent — duplicate references return the existing transaction.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['amount', 'reference'],
    properties: {
      amount: { type: 'number', minimum: 0.01 },
      reference: { type: 'string', minLength: 1 },
      source: {
        type: 'string',
        enum: ['topup', 'order_payment', 'refund', 'withdrawal', 'bonus'],
        default: 'order_payment',
      },
      metadata: { type: 'object', additionalProperties: true },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { transaction: transactionObject } },
      },
    },
    400: errorResponse,
    401: unauthorized,
    404: errorResponse,
  },
};

// ─── POST /wallet/refund ──────────────────────────────────────────────────────

export const refundSchema: FastifySchema = {
  tags: ['Wallet'],
  summary: 'Credit wallet as refund (admin only)',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['userId', 'amount', 'reference'],
    properties: {
      userId: { type: 'string', minLength: 1 },
      amount: { type: 'number', minimum: 0.01 },
      reference: { type: 'string', minLength: 1 },
      metadata: { type: 'object', additionalProperties: true },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { transaction: transactionObject } },
      },
    },
    400: errorResponse,
    401: unauthorized,
    403: errorResponse,
    404: errorResponse,
  },
};
