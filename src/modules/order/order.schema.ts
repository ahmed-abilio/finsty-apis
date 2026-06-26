import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';
import { ORDER_STATUS_VALUES } from './order-status.constants';

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
  description:
    'Order reference: Finsty UUID, public `FI…` order code, or Shadowfax `shadowfaxOrderId` from order responses.',
} as const;

const shadowfaxRiderLocationObject = {
  type: 'object',
  properties: {
    longitude: { type: 'string' },
    latitude: { type: 'string' },
  },
} as const;

const shadowfaxRiderDetailsObject = {
  type: 'object',
  properties: {
    rider_name: { type: 'string' },
    rider_location: shadowfaxRiderLocationObject,
    rider_phone: { type: 'string' },
  },
} as const;

const shadowfaxOrderStatusDetailsObject = {
  type: 'object',
  additionalProperties: true,
  properties: {
    order_value: { type: 'number' },
    scheduled_time: { type: 'string' },
    paid: { type: 'string' },
    preparation_time: { type: 'number' },
    client_order_id: { type: 'string' },
    pickup_eta: { type: 'number', nullable: true },
    drop_eta: { type: 'number', nullable: true },
    allot_time: { type: 'string', nullable: true },
    arrival_time: { type: 'string', nullable: true },
    dispatch_time: { type: 'string', nullable: true },
    delivery_time: { type: 'string', nullable: true },
    vehicle_number: { type: 'string', nullable: true },
    order_date: { type: 'string' },
  },
} as const;

const shadowfaxLocationSummaryObject = {
  type: 'object',
  additionalProperties: true,
  properties: {
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    city: { type: 'string' },
    name: { type: 'string' },
    address: { type: 'string' },
  },
} as const;

const shadowfaxPickupDetailsObject = {
  type: 'object',
  additionalProperties: true,
  properties: {
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    city: { type: 'string' },
    name: { type: 'string' },
    address: { type: 'string' },
    contact_number: { type: 'string' },
  },
} as const;

const shadowfaxOrderStatusItemObject = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    quantity: { type: 'number' },
    price: { type: 'number' },
    weight: { type: 'number', nullable: true },
    category: { type: 'string', nullable: true },
    unit_price: { type: 'number' },
  },
} as const;

const shadowfaxOrderStatusDataObject = {
  type: 'object',
  additionalProperties: true,
  properties: {
    client_code: { type: 'string' },
    status: { type: 'string', description: 'Shadowfax status e.g. ALLOTTED, DISPATCHED, DELIVERED' },
    rider_details: shadowfaxRiderDetailsObject,
    sfx_order_id: { type: 'number' },
    order_details: shadowfaxOrderStatusDetailsObject,
    drop_details: shadowfaxLocationSummaryObject,
    order_items: { type: 'array', items: shadowfaxOrderStatusItemObject },
    track_url: { type: 'string', nullable: true },
    drop_image_url: { type: 'string', nullable: true },
    pickup_details: shadowfaxPickupDetailsObject,
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

const colorImageObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    colorId: { type: 'string', format: 'uuid' },
    imageUrl: { type: 'string', format: 'uri' },
    altText: { type: 'string', nullable: true },
    displayOrder: { type: 'number' },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    updatedAt: { type: 'string', nullable: true, format: 'date-time' },
  },
} as const;

const orderVariantColorObject = {
  type: 'object',
  nullable: true,
  description: 'Full colour group for this line item (not just colorId).',
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    colorName: { type: 'string' },
    colorHex: { type: 'string', nullable: true },
    images: { type: 'array', items: colorImageObject },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    updatedAt: { type: 'string', nullable: true, format: 'date-time' },
  },
} as const;

const variantObject = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    colorId: { type: 'string', format: 'uuid', description: 'FK to `color.id`.' },
    size: { type: 'string', nullable: true },
    sku: { type: 'string', nullable: true },
    stock: { type: 'number' },
    additionalPrice: { type: 'number' },
    label: { type: 'string' },
    imageUrl: {
      type: 'string',
      nullable: true,
      format: 'uri',
      description: 'Resolved display image (first colour image, else product image).',
    },
    color: orderVariantColorObject,
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    updatedAt: { type: 'string', nullable: true, format: 'date-time' },
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

const reviewImageObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    reviewId: { type: 'string', format: 'uuid' },
    imageUrl: { type: 'string', format: 'uri' },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    updatedAt: { type: 'string', nullable: true, format: 'date-time' },
  },
} as const;

const myReviewObject = {
  type: 'object',
  nullable: true,
  description: "Authenticated user's review for this product, if they have submitted one.",
  properties: {
    id: { type: 'string', format: 'uuid' },
    rating: { type: 'number', minimum: 1, maximum: 5 },
    comment: { type: 'string', nullable: true },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    images: {
      type: 'array',
      items: reviewImageObject,
      description: 'Photos attached to the review at submission time.',
    },
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
    basePrice: {
      type: 'number',
      nullable: true,
      description: 'Raw product base price (per unit, before discount and variant adjustment). Nullable for orders created before the price-breakdown columns were added.',
    },
    discountPercent: {
      type: 'number',
      nullable: true,
      description: 'Effective discount percent locked at checkout (0 when outside the discount window).',
    },
    discountAmount: {
      type: 'number',
      nullable: true,
      description:
        'Per-unit savings from the product discount when the window was active at checkout. ' +
        'Discount applies to `(basePrice + additionalPrice)` per unit, not base alone.',
    },
    discountedBasePrice: {
      type: 'number',
      nullable: true,
      description:
        'Per-unit catalogue base after discount. The variant surcharge was reduced by the same percent; see `unitPrice` for the final per-unit charge.',
    },
    additionalPrice: {
      type: 'number',
      nullable: true,
      description: 'Variant.additionalPrice snapshot at checkout before discount (0 when no variant).',
    },
    unitPrice: {
      type: 'number',
      description: 'Final per-unit price paid: discounted base plus discounted variant additional.',
    },
    quantity: { type: 'number' },
    totalPrice: { type: 'number', description: 'unitPrice * quantity.' },
    productImage: { type: 'string', nullable: true, format: 'uri', description: 'Resolved product image for this item' },
    variant: variantObject,
    store: orderItemStoreObject,
    userRating: {
      type: 'number',
      nullable: true,
      minimum: 1,
      maximum: 5,
      description: 'Same as `myReview.rating` when the user has reviewed this product; `null` otherwise.',
    },
    myReview: myReviewObject,
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

export const orderObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    orderId: {
      type: 'string',
      description: 'Public order code (12 chars): FI + base36 time + millisecond + retry token.',
      pattern: '^FI[A-Z0-9]{6}\\d{3}[A-Z0-9]$',
    },
    userId: { type: 'string' },
    addressId: { type: 'string', nullable: true },
    status: {
      type: 'string',
      enum: [...ORDER_STATUS_VALUES],
    },
    deliveryType: { type: 'string', enum: ['delivery', 'pickup'] },
    subtotal: { type: 'number' },
    taxAmount: { type: 'number' },
    platformFee: { type: 'number', description: 'Fixed platform fee per order in INR (from `PLATFORM_FEE`).' },
    deliveryCharge: { type: 'number' },
    totalAmount: { type: 'number' },
    notes: { type: 'string', nullable: true },
    originalBasePrice: {
      type: 'number',
      description: 'Sum of (basePrice * quantity) across all line items — the true pre-discount, pre-variant-adjustment catalogue total.',
    },
    discountAmount: { type: 'number' },
    couponCode: { type: 'string', nullable: true },
    items: { type: 'array', items: orderItemObject },
    address: addressObject,
    paymentType: { type: 'string', nullable: true, enum: ['card', 'upi', 'netbanking', 'wallet', 'other'], description: 'Payment method used for this order' },
    walletAmountPaid: {
      type: 'number',
      description:
        'INR debited from the user wallet for this order (full wallet, pay-wallet, or partial wallet on Razorpay capture). `0` when none.',
    },
    shadowfaxOrderId: {
      type: 'number',
      nullable: true,
      description:
        'Shadowfax logistics order id after a delivery shipment is placed. `null` for pickup orders or before Shadowfax placement completes.',
    },
    shadowfaxTrackingUrl: { type: 'string', nullable: true },
    deliveryPartner: { type: 'string' },
    deliveredAt: { type: 'string', nullable: true, format: 'date-time' },
    cancelledAt: { type: 'string', nullable: true, format: 'date-time' },
    returnedAt: { type: 'string', nullable: true, format: 'date-time' },
    riderId: { type: 'number', nullable: true },
    riderName: { type: 'string', nullable: true },
    riderPhone: { type: 'string', nullable: true },
    riderDetails: {
      type: 'object',
      nullable: true,
      description: 'Assigned delivery rider (from Shadowfax sync).',
      properties: {
        id: { type: 'number', nullable: true },
        name: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        location: {
          type: 'object',
          nullable: true,
          properties: {
            latitude: { type: 'string', nullable: true },
            longitude: { type: 'string', nullable: true },
          },
        },
      },
    },
    cancellation: {
      type: 'object',
      nullable: true,
      description: 'Shadowfax / logistics cancellation details when applicable.',
      properties: {
        cancelledAt: { type: 'string', nullable: true, format: 'date-time' },
        reason: { type: 'string', nullable: true, description: 'Cancellation type label e.g. Cancelled by Customer' },
        reasonText: { type: 'string', nullable: true, description: 'Detail text for the cancel reason code e.g. Damaged products' },
      },
    },
    deliveryMetadata: { type: 'object', nullable: true, additionalProperties: true },
    payments: { type: 'array', items: paymentObject },
    deliveryWaivedReason: {
      type: 'string',
      nullable: true,
      enum: ['pickup', 'free_delivery_coupon'],
      description: 'Why delivery charge is zero, when applicable; `null` when delivery was charged.',
    },
    deliveryConfig: {
      type: 'object',
      additionalProperties: true,
      properties: {
        freeDeliveryRequiresCoupon: { type: 'boolean' },
      },
    },
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
    '`totalAmount` includes merchandise subtotal, tax (`TAX_RATE` on subtotal), fixed `PLATFORM_FEE`, delivery when applicable, minus coupon discounts. ' +
    'Returns **400** with `MULTI_STORE_CHECKOUT` when selected cart items belong to more than one store. ' +
    'Delivery fees use Shadowfax serviceability (see `deliveryCharge`); free delivery applies only with a `FREE_DELIVERY` coupon (not by subtotal). ' +
    'For delivery, the server fetches the Shadowfax fee using the given `addressId` or the user default address (`GET /cart/delivery-quote` for preview). ' +
    'Possible error codes include `ADDRESS_COORDINATES_REQUIRED`, `DEFAULT_ADDRESS_REQUIRED`, `DELIVERY_CHARGE_MISMATCH`, `DELIVERY_NOT_SERVICEABLE`, `COUPON_NOT_STACKABLE`, and `COUPON_STACK_LIMIT`. ' +
    '**Stacking:** send `couponCodes` (array). When more than one code is used, every coupon must have `isStackable: true`. `autoApply` still applies only the single best coupon (no multi-stack).',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['deliveryType'],
    properties: {
      deliveryType: {
        type: 'string',
        enum: ['delivery', 'pickup'],
        description: '`delivery` uses `addressId` or the user default address. `pickup` does not need an address.',
      },
      addressId: {
        type: 'string',
        format: 'uuid',
        description:
          'Delivery address. When omitted for `delivery`, the user default address is used.',
      },
      notes: { type: 'string', maxLength: 500 },
      deliveryCharge: {
        type: 'number',
        minimum: 0,
        description:
          'Optional sanity check. The server always computes delivery from Shadowfax; when provided it must match `deliveryChargeApplied` from `GET /cart/delivery-quote`. Omitted for `pickup` or when a FREE_DELIVERY coupon waives the fee.',
      },
      couponCode: {
        type: 'string',
        description:
          'Optional single coupon code (legacy). Ignored when `couponCodes` is non-empty; prefer `couponCodes` for stackable checkout.',
      },
      couponCodes: {
        type: 'array',
        maxItems: 10,
        items: { type: 'string', minLength: 1 },
        description:
          'Optional list of coupon codes in application order. When length > 1, each coupon must be stackable. FLAT/PERCENTAGE discounts combine sequentially on the remaining subtotal.',
      },
      autoApply: {
        type: 'boolean',
        description:
          'If true, the system selects the single coupon yielding the highest saving. Ignored when `couponCodes` or `couponCode` is provided.',
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
    400: validationErrorResponse,
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
  description:
    'Each order item includes `myReview` (rating, comment, images) and `userRating` when the user has reviewed that product.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
      status: {
        type: 'string',
        enum: [...ORDER_STATUS_VALUES],
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

// ─── GET /orders/:orderId/delivery-status ─────────────────────────────────────

export const getOrderDeliveryStatusSchema: FastifySchema = {
  tags: ['Orders'],
  operationId: 'getOrderDeliveryStatus',
  summary: 'GET /orders/{orderId}/delivery-status — live Shadowfax tracking',
  description:
    '**Path:** `GET /api/v1/orders/:orderId/delivery-status` — proxies Shadowfax `GET /api/v2/orders/{sfxOrderId}/status/`. ' +
    'Requires a placed Shadowfax shipment (after payment). Poll for rider location, ETAs, and `track_url`.\n\n' +
    '**Auth:** buyers see their own orders; vendors see orders that include items from their store; admins see any order. ' +
    '`orderId` accepts Finsty UUID, public `FI…` code, or Shadowfax `shadowfaxOrderId`.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: {
      orderId: orderRefParam,
    },
  },
  response: {
    200: {
      description: 'Live Shadowfax delivery status (inner `data` from Shadowfax)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: shadowfaxOrderStatusDataObject,
      },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
    502: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
      },
    },
  },
};

// ─── GET /orders/:orderId ─────────────────────────────────────────────────────

export const getOrderSchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Get order detail',
  description:
    'Returns the full order including items, delivery address, store details, nested `variant.color`, `myReview` (with review images) / `userRating` when the user has reviewed that product, `walletAmountPaid` for wallet used at checkout, and `shadowfaxOrderId` when a delivery shipment exists.',
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
  description:
    'Buyers (`user: "Customer"`) and vendors (`user: "Seller"`) can cancel via this endpoint. ' +
    'Buyers may cancel only `pending` or `confirmed` orders. Vendors may cancel store orders in any cancellable in-flight status. ' +
    'For confirmed delivery orders already placed on Shadowfax, `reason` and `user` are forwarded to the Shadowfax cancel API.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: orderRefParam },
  },
  body: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        minLength: 1,
        description:
          'Human-readable cancel reason sent to Shadowfax (e.g. `Damaged products`). Defaults to `Cancelled by customer`.',
      },
      user: {
        type: 'string',
        enum: ['Customer', 'Seller'],
        description: 'Shadowfax cancel actor. Defaults to `Customer` for buyers and `Seller` for vendors.',
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
    400: validationErrorResponse,
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
    properties: { orderId: orderRefParam },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { order: orderObject, walletBalance: { type: 'number' } } },
      },
    },
    400: validationErrorResponse,
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /orders/vendor ────────────────────────────────────────────────────────

export const listVendorOrdersSchema: FastifySchema = {
  tags: ['Orders'],
  operationId: 'listVendorOrders',
  summary: 'GET /orders/vendor — list store orders (vendor)',
  description:
    '**Path:** `GET /api/v1/orders/vendor` — vendor/admin only.\n\n' +
    'Returns paginated orders that contain at least one line item from the authenticated vendor\'s store. ' +
    'Response items use the same `orderObject` shape as buyer order lists (items, address, payments, `walletAmountPaid`, `shadowfaxOrderId`).\n\n' +
    '**Filters:**\n' +
    '- `status` — exact match on order status. When omitted, `pending` (unpaid) orders are excluded.\n' +
    '- `from` / `to` — optional ISO 8601 range on `order.createdAt` (both inclusive). ' +
    'If either is sent, both are required.\n' +
    '- `page` / `limit` — standard pagination (default page `1`, limit `20`, max `50`).',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'number', minimum: 1, default: 1, description: 'Page number (1-based)' },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        default: 20,
        description: 'Orders per page (max 50)',
      },
      status: {
        type: 'string',
        enum: [...ORDER_STATUS_VALUES],
        description: 'Filter by order status. Omit to exclude pending (unpaid) orders.',
      },
      from: {
        type: 'string',
        format: 'date-time',
        description:
          'Range start on `createdAt` (ISO 8601, inclusive). Requires `to`. e.g. `2026-06-01T00:00:00.000Z`.',
      },
      to: {
        type: 'string',
        format: 'date-time',
        description:
          'Range end on `createdAt` (ISO 8601, inclusive). Requires `from`. e.g. `2026-06-30T23:59:59.999Z`.',
      },
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
            orders: { type: 'array', items: orderObject },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    400: badRequest,
    401: unauthorized,
    403: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
      },
    },
  },
};

const orderCustomerObject = {
  type: 'object',
  nullable: true,
  description: 'Buyer profile for fulfillment and support contact.',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true, format: 'email' },
    profileImage: { type: 'string', nullable: true, format: 'uri' },
  },
} as const;

const vendorOrderDetailObject = {
  type: 'object',
  properties: {
    ...orderObject.properties,
    customer: orderCustomerObject,
  },
} as const;

// ─── GET /orders/vendor/:orderId ───────────────────────────────────────────────

export const vendorGetOrderSchema: FastifySchema = {
  tags: ['Orders'],
  operationId: 'getVendorOrder',
  summary: 'GET /orders/vendor/{orderId} — order detail with customer (vendor)',
  description:
    'Returns full order details when the order contains at least one line item from the authenticated vendor\'s store. ' +
    'Shadowfax status, rider details, and cancellation metadata are synced on read (same as buyer `GET /orders/:orderId`). ' +
    'Includes the same fields as `GET /orders/vendor` list items (items, address, payments, `walletAmountPaid`, `shadowfaxOrderId`) ' +
    'plus a `customer` object (`id`, `name`, `phone`, `email`, `profileImage`) for the buyer. ' +
    'Returns 404 if the order does not exist or is not accessible to this vendor.',
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
        data: { type: 'object', properties: { order: vendorOrderDetailObject } },
      },
    },
    401: unauthorized,
    403: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
      },
    },
    404: notFound,
  },
};

// ─── PUT /orders/vendor/:orderId/dispatch-ready ──────────────────────────────

export const vendorDispatchReadySchema: FastifySchema = {
  tags: ['Orders'],
  summary: 'Mark order dispatch-ready (vendor)',
  description:
    'Notifies Shadowfax that the seller has packed the order and it is ready for rider pickup. ' +
    'Shadowfax expects the Finsty order UUID (`client_order_id`) in the upstream URL. ' +
    'Only delivery orders in `confirmed`, `rider_assigned`, or `at_store` status with a placed Shadowfax shipment are eligible.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: orderRefParam },
  },
  body: {
    type: 'object',
    required: ['shipment_ready_timestamp'],
    properties: {
      shipment_ready_timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'ISO-8601 timestamp when the order became ready for dispatch.',
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', additionalProperties: true },
      },
    },
    400: badRequest,
    401: unauthorized,
    403: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
      },
    },
    404: notFound,
    409: conflict,
    502: badRequest,
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
    properties: { orderId: orderRefParam },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: [
          ...ORDER_STATUS_VALUES,
          'processing',
          'shipped',
        ],
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
    400: validationErrorResponse,
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
    properties: { orderId: orderRefParam },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: [
          ...ORDER_STATUS_VALUES,
          'processing',
          'shipped',
        ],
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
    400: validationErrorResponse,
    401: unauthorized,
    403: notFound,
    404: notFound,
  },
};
