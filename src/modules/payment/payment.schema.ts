import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

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
  summary: 'Initiate a payment (Razorpay, wallet, or partial)',
  description:
    'Creates a payment. When `useWallet: true` the wallet balance is applied first. ' +
    'If the wallet covers the full order, it is confirmed immediately (no Razorpay). ' +
    'If partial, Razorpay covers only the remainder. ' +
    'After the user completes Razorpay, call `/payments/capture`. ' +
    '**Security:** for order payments (`orderId` provided), the chargeable amount is ' +
    'always derived from the server-stored `Order.totalAmount`. The `amount` field in ' +
    'the request body is ignored except as a sanity check — if it differs from the ' +
    'server-calculated total by more than 0.01 INR the request is rejected with ' +
    '`AMOUNT_MISMATCH`. `amount` is only required for wallet top-ups (no `orderId`). ' +
    'For **delivery** orders, the server re-validates the saved address and replays Shadowfax before creating a Razorpay order (`DELIVERY_NOT_SERVICEABLE`, `DELIVERY_CHARGE_MISMATCH`, `ADDRESS_COORDINATES_REQUIRED`). ' +
    'Clients should use `GET /cart/delivery-quote` or `order.totalAmount` so checkout matches payment. ' +
    'On `AMOUNT_MISMATCH`, inspect `error.details` for `suggestedAmount`, `deliveryWaivedReason`, and `hint`.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      orderId: {
        type: 'string',
        format: 'uuid',
        description:
          'When provided, the chargeable amount is taken from the order total — the `amount` field is ignored (except for an optional mismatch sanity check).',
      },
      amount: {
        type: 'number',
        minimum: 0,
        description:
          'Amount in INR. **Required only for wallet top-ups** (no `orderId`). ' +
          'For order payments this value is never trusted — the server always uses `Order.totalAmount`. ' +
          'If supplied, it is compared to the server-computed expected charge and a mismatch returns `AMOUNT_MISMATCH`: ' +
          'when `useWallet` is absent or false the expected value is `Order.totalAmount`; ' +
          'when `useWallet: true` the expected value is `Order.totalAmount - min(walletBalance, Order.totalAmount)` ' +
          '(i.e. the Razorpay portion after the wallet is applied — `0` when the wallet fully covers the order).',
      },
      currency: { type: 'string', default: 'INR', maxLength: 10 },
      useWallet: { type: 'boolean', description: 'Apply wallet balance first; Razorpay covers the remainder' },
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
          additionalProperties: true,
          properties: {
            // Razorpay path
            paymentId: { type: 'string' },
            checkoutUrl: { type: 'string' },
            providerOrderId: { type: 'string', description: 'Razorpay order ID' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            walletAmountToBeDeducted: { type: 'number', description: 'Wallet portion held for capture (Case B)' },
            // Full-wallet path
            fullyPaidByWallet: { type: 'boolean', description: 'True when wallet covered the entire order (Case A)' },
            walletBalance: { type: 'number' },
            walletAmountUsed: { type: 'number' },
            orderId: { type: 'string' },
          },
        },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    404: errorResponse,
  },
};

// ─── POST /payments/cancel-incomplete ─────────────────────────────────────────

export const cancelIncompletePaymentSchema: FastifySchema = {
  tags: ['Payments'],
  summary: 'Cancel an incomplete checkout',
  description:
    'Call when the user closes the Razorpay (or payment) UI without completing capture. ' +
    'Marks pending payment rows as `failed`, keeps the order `pending` so checkout can be retried, ' +
    'and sends a `PAYMENT_CANCELLED` push notification.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['orderId'],
    properties: {
      orderId: { type: 'string', format: 'uuid' },
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
            paymentsFailed: { type: 'number' },
          },
        },
      },
    },
    400: validationErrorResponse,
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
          additionalProperties: true,
          properties: {
            success: { type: 'boolean' },
            walletBalance: { type: 'number', description: 'Wallet balance after capture' },
            walletAmountUsed: { type: 'number', description: 'Wallet portion deducted (0 if no wallet used)' },
            razorpayAmountPaid: { type: 'number', description: 'Amount paid via Razorpay' },
          },
        },
      },
    },
    400: validationErrorResponse,
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
    400: validationErrorResponse,
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
    400: validationErrorResponse,
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
