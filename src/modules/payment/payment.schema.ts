import { FastifySchema } from 'fastify';

// ─── Shared shapes ────────────────────────────────────────────────────────────

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

const paymentObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    orderId: { type: 'string', nullable: true },
    walletId: { type: 'string' },
    userId: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string' },
    status: {
      type: 'string',
      enum: ['pending', 'captured', 'failed', 'refund_requested', 'refunded'],
    },
    provider: { type: 'string' },
    providerOrderId: { type: 'string' },
    providerPaymentId: { type: 'string', nullable: true },
    paymentType: { type: 'string', nullable: true, enum: ['card', 'upi', 'netbanking', 'wallet', 'other'] },
    refundRequestedAt: { type: 'string', nullable: true },
    refundProcessedAt: { type: 'string', nullable: true },
    refundNote: { type: 'string', nullable: true },
    metadata: { type: 'object', nullable: true, additionalProperties: true },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

// ─── POST /payments/initiate ──────────────────────────────────────────────────

export const initiatePaymentSchema: FastifySchema = {
  tags: ['Payments'],
  summary: 'Initiate a Razorpay payment',
  description:
    'Creates a Razorpay order and returns the checkout URL. ' +
    'After the user completes payment, call `/payments/capture` with the Razorpay callback data.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      orderId: { type: 'string', format: 'uuid', description: 'Optional — link payment to an order' },
      amount: { type: 'number', minimum: 1, description: 'Amount in INR (rupees, not paise)' },
      currency: { type: 'string', default: 'INR', maxLength: 10 },
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
            paymentId: { type: 'string' },
            checkoutUrl: { type: 'string' },
            providerOrderId: { type: 'string', description: 'The order ID from the payment provider (e.g., Razorpay Order ID)' },
            amount: { type: 'number' },
            currency: { type: 'string' },
          },
        },
      },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
  },
};

// ─── POST /payments/capture ───────────────────────────────────────────────────

export const capturePaymentSchema: FastifySchema = {
  tags: ['Payments'],
  summary: 'Capture a completed Razorpay payment',
  description:
    'Verifies the Razorpay signature, confirms payment with Razorpay, credits the wallet, ' +
    'and marks the linked order as confirmed. Idempotent — safe to call twice.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['paymentId', 'providerPaymentId', 'providerSignature'],
    properties: {
      paymentId: { type: 'string', format: 'uuid' },
      providerPaymentId: { type: 'string', minLength: 1, description: 'razorpay_payment_id from callback' },
      providerSignature: { type: 'string', minLength: 1, description: 'razorpay_signature from callback' },
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
            walletBalance: { type: 'number' },
          },
        },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── POST /payments/:paymentId/refund-request ─────────────────────────────────

export const requestRefundSchema: FastifySchema = {
  tags: ['Payments'],
  summary: 'Request a refund for a cancelled order',
  description:
    'Does NOT call Razorpay. Marks the payment as refund_requested and notifies the admin. ' +
    'Admin will manually credit the wallet.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['paymentId'],
    properties: { paymentId: { type: 'string', format: 'uuid' } },
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
        data: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── GET /payments/:paymentId ─────────────────────────────────────────────────

export const getPaymentSchema: FastifySchema = {
  tags: ['Payments'],
  summary: 'Get a payment by ID',
  description: 'Users can only fetch their own payments. Admins can fetch any payment.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['paymentId'],
    properties: { paymentId: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { payment: paymentObject } },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── POST /payments/admin/:paymentId/process-refund ───────────────────────────

export const processRefundSchema: FastifySchema = {
  tags: ['Payments — Admin'],
  summary: 'Process a pending refund request (admin only)',
  description:
    'Credits the user wallet for the full payment amount and marks the payment as refunded. ' +
    'Uses row-level locking to prevent double-processing.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['paymentId'],
    properties: { paymentId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      note: { type: 'string', maxLength: 500 },
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
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── GET /payments/admin/refund-requests ──────────────────────────────────────

export const listRefundRequestsSchema: FastifySchema = {
  tags: ['Payments — Admin'],
  summary: 'List all pending refund requests (admin only)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
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
            payments: { type: 'array', items: paymentObject },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
};
// ─── GET /payments/config ────────────────────────────────────────────────────
export const getPaymentConfigSchema: FastifySchema = {
  tags: ['Payments'],
  summary: 'Get payment provider configuration',
  description: 'Returns public configuration like Razorpay Key ID.',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            razorpayKeyId: { type: 'string' },
          },
        },
      },
    },
    401: errorResponse,
  },
};
