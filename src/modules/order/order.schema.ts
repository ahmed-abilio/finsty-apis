import { FastifySchema } from 'fastify';

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

const orderItemStoreObject = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    logoUrl: { type: ['string', 'null'] },
    city: { type: 'string' },
    state: { type: 'string' },
    address: { type: 'string' },
    phone: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    rating: { type: 'number' },
    isActive: { type: 'boolean' },
  },
} as const;

const variantObject = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    colorId: { type: 'string' },
    size: { type: 'string', nullable: true },
    sku: { type: 'string', nullable: true },
    stock: { type: 'number' },
    additionalPrice: { type: 'number' },
    label: { type: 'string' },
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
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
    status: { type: 'string', enum: ['pending', 'captured', 'failed', 'refund_requested', 'refunded'] },
    provider: { type: 'string' },
    providerOrderId: { type: 'string' },
    providerPaymentId: { type: 'string', nullable: true },
    paymentType: { type: 'string', nullable: true, enum: ['card', 'upi', 'netbanking', 'wallet', 'other'] },
    refundRequestedAt: { type: 'string', nullable: true },
    refundProcessedAt: { type: 'string', nullable: true },
    refundNote: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const orderItemObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    orderId: { type: 'string' },
    productId: { type: 'string' },
    variantId: { type: 'string', nullable: true },
    productName: { type: 'string' },
    variantLabel: { type: 'string', nullable: true },
    unitPrice: { type: 'number' },
    quantity: { type: 'number' },
    totalPrice: { type: 'number' },
    productImage: { type: 'string', nullable: true, format: 'uri', description: 'Resolved product image for this item' },
    variant: variantObject,
    store: orderItemStoreObject,
  },
} as const;

const addressObject = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string' },
    line1: { type: 'string' },
    line2: { type: 'string', nullable: true },
    city: { type: 'string' },
    state: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    label: { type: 'string', nullable: true },
  },
} as const;

const orderObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    addressId: { type: 'string', nullable: true },
    status: {
      type: 'string',
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    },
    deliveryType: { type: 'string', enum: ['delivery', 'pickup'] },
    subtotal: { type: 'number' },
    taxAmount: { type: 'number' },
    deliveryCharge: { type: 'number' },
    totalAmount: { type: 'number' },
    notes: { type: 'string', nullable: true },
    originalBasePrice: { type: 'number' },
    discountAmount: { type: 'number' },
    couponCode: { type: 'string', nullable: true },
    items: { type: 'array', items: orderItemObject },
    address: addressObject,
    paymentType: { type: 'string', nullable: true, enum: ['card', 'upi', 'netbanking', 'wallet', 'other'], description: 'Payment method used for this order' },
    payments: { type: 'array', items: paymentObject },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

// ─── Job / pending-order status object ───────────────────────────────────────

const jobStatusObject = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'The jobId returned from POST /orders' },
    userId: { type: 'string' },
    jobId: { type: 'string', nullable: true, description: 'Internal BullMQ job ID' },
    status: {
      type: 'string',
      enum: ['queued', 'processing', 'success', 'failed'],
      description:
        '`queued` — waiting in queue | `processing` — worker is running | ' +
        '`success` — order created | `failed` — see failureCode / failureMessage',
    },
    orderId: {
      type: 'string',
      nullable: true,
      description: 'Populated once status is `success`. Use GET /orders/:orderId to fetch detail.',
    },
    failureCode: { type: 'string', nullable: true },
    failureMessage: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

// ─── POST /orders ─────────────────────────────────────────────────────────────

export const createOrderSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Enqueue an order from the current cart (async)',
  description:
    'Validates the cart and address, snapshots pricing and coupon data, then enqueues a ' +
    'background job. Returns **202 Accepted** immediately (< 50 ms). ' +
    'The returned `jobId` can be polled via **GET /orders/status/:jobId** to get the final ' +
    '`success` (with `orderId`) or `failed` (with `failureCode`) outcome. ' +
    'This architecture allows the server to survive viral / flash-sale traffic spikes. ' +
    'Returns **400** with `MULTI_STORE_CHECKOUT` when selected cart items belong to more than one store.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['deliveryType'],
    properties: {
      deliveryType: {
        type: 'string',
        enum: ['delivery', 'pickup'],
        description: '`delivery` requires `addressId`. `pickup` does not.',
      },
      addressId: {
        type: 'string',
        description: 'Required when deliveryType is `delivery`.',
      },
      notes: { type: 'string', maxLength: 500 },
      couponCode: {
        type: 'string',
        description: 'Optional coupon code to apply to this order.',
      },
      autoApply: {
        type: 'boolean',
        description: 'If true, the system selects the coupon yielding the highest saving.',
      },
    },
    additionalProperties: false,
  },
  response: {
    202: {
      description: 'Order accepted and queued for processing',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Stable token — use with GET /orders/status/:jobId to poll result.',
            },
            message: { type: 'string' },
          },
        },
      },
    },
    400: notFound,
    401: unauthorized,
  },
};

// ─── GET /orders/status/:jobId ────────────────────────────────────────────────

export const getJobStatusSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Poll the processing status of a queued order',
  description:
    'Returns the current state of a background order job. ' +
    'When `status` is `success`, `orderId` is populated and the full order can be fetched ' +
    'via **GET /orders/:orderId**. When `status` is `failed`, check `failureCode` — ' +
    '`INSUFFICIENT_STOCK` means stock ran out after the user submitted.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['jobId'],
    properties: { jobId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { job: jobStatusObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /orders ──────────────────────────────────────────────────────────────

export const listOrdersSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'List all orders for the authenticated user',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
      status: {
        type: 'string',
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        description: 'Filter orders by status. If omitted, pending orders are excluded.',
      },
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
            orders: { type: 'array', items: orderObject },
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

// ─── GET /orders/:orderId ─────────────────────────────────────────────────────

export const getOrderSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Get order detail',
  description: 'Returns the full order including items, delivery address, and the store details for each item\'s product.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { order: orderObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── PATCH /orders/:orderId/cancel ────────────────────────────────────────────

export const cancelOrderSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Cancel an order',
  description: 'Only orders with status `pending` or `confirmed` can be cancelled.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { order: orderObject } },
      },
    },
    400: notFound,
    401: unauthorized,
    404: notFound,
  },
};

// ─── POST /orders/:orderId/pay-wallet ─────────────────────────────────────────

export const payWithWalletSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Pay for an order using internal wallet',
  description: 'Deducts the order total from the user\'s wallet and confirms the order natively without external providers.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { order: orderObject, walletBalance: { type: 'number' } } },
      },
    },
    400: notFound,
    401: unauthorized,
    404: notFound,
  },
};

// ─── PATCH /orders/vendor/:orderId/status ────────────────────────────────────

export const vendorUpdateStatusSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Update order status (vendor)',
  description:
    'Allows a vendor to advance an order through its lifecycle. ' +
    'Only orders containing items from the vendor\'s own store can be updated. ' +
    'Transitioning to `delivered` automatically triggers the referral reward ' +
    'for both the referrer and the referred user (first order only).',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        description: 'New status to transition the order to',
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { order: orderObject } },
      },
    },
    400: notFound,
    401: unauthorized,
    403: notFound,
    404: notFound,
  },
};

// ─── PATCH /admin/orders/:orderId/status ──────────────────────────────────────

export const adminUpdateStatusSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Update order status (admin only)',
  description:
    'Moves an order through its lifecycle. Transitioning to `delivered` automatically ' +
    'triggers the referral reward for both the referrer and the referred user (first order only).',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        description: 'New status to transition the order to',
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { order: orderObject } },
      },
    },
    400: notFound,
    401: unauthorized,
    403: notFound,
    404: notFound,
  },
};
