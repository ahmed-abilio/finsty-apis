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

const badRequest = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const notificationCategoryEnum = [
  'orders',
  'inventory',
  'payments',
  'wallet',
  'promotions',
  'account',
  'general',
] as const;

const notificationTypeEnum = [
  'LOGIN_SUCCESS',
  'ORDER_PLACED',
  'ORDER_STATUS',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PAYMENT_CANCELLED',
  'WALLET_CREDITED',
  'WALLET_DEBITED',
  'CASHBACK_RECEIVED',
  'REFERRAL_REWARD_CREDITED',
  'COUPON_APPLIED',
  'RATE_ORDER_REMINDER',
  'VENDOR_NEW_ORDER',
  'VENDOR_LOW_STOCK',
  'VENDOR_OUT_OF_STOCK',
  'ADMIN_STORE_APPLICATION',
  'ADMIN_COUPON_APPLICATION',
  'ADMIN_BANNER_APPLICATION',
  'VENDOR_STORE_APPROVED',
  'VENDOR_STORE_REJECTED',
  'VENDOR_COUPON_APPROVED',
  'VENDOR_BANNER_APPROVED',
  'VENDOR_ORDER_CANCELLED',
] as const;

const INBOX_OVERVIEW =
  'Persisted in-app notification history for the authenticated user. Inbox rows are created when push ' +
  'notifications are enqueued (alongside FCM delivery). Scope is **JWT `role`** (`user`, `vendor`, or `admin`) — ' +
  'the same user id with different roles has separate inboxes.';

const VENDOR_CATEGORY_DOC =
  '**Vendor `category` filter** (query on `GET /notifications`):\n' +
  '- `orders` — `VENDOR_NEW_ORDER`\n' +
  '- `inventory` — `VENDOR_LOW_STOCK`, `VENDOR_OUT_OF_STOCK`\n' +
  '- `account` — `LOGIN_SUCCESS`\n\n' +
  'Invalid category for the current role returns `400 INVALID_NOTIFICATION_CATEGORY`.';

const CUSTOMER_CATEGORY_DOC =
  '**Customer `category` filter:** `orders`, `payments`, `wallet`, `promotions`, `account`.';

const notificationObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    role: { type: 'string', enum: ['user', 'vendor', 'admin'] },
    type: {
      type: 'string',
      enum: notificationTypeEnum,
      description: 'Notification type constant — matches FCM `data.type`.',
    },
    category: {
      type: 'string',
      enum: notificationCategoryEnum,
      description:
        'Grouped inbox category. Vendor: `orders`, `inventory`, `account`. ' +
        'Customer: `orders`, `payments`, `wallet`, `promotions`, `account`. Admin: `account`.',
    },
    title: { type: 'string', description: 'Notification title shown in push and inbox.' },
    body: { type: 'string', description: 'Notification body text.' },
    data: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description:
        'Deep-link context (all string values). Common keys: `type`, `click_action`, `orderId`, `orderNumber`, `productId`, `productName`, `stock`, `amount`, `status`.',
    },
    isRead: { type: 'boolean' },
    readAt: { type: 'string', nullable: true, format: 'date-time' },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    updatedAt: { type: 'string', nullable: true, format: 'date-time' },
  },
} as const;

const listQuerystring = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'number', minimum: 1, default: 1, description: 'Page number (1-based)' },
    limit: {
      type: 'number',
      minimum: 1,
      maximum: 50,
      default: 20,
      description: 'Notifications per page (max 50)',
    },
    category: {
      type: 'string',
      enum: notificationCategoryEnum,
      description:
        'Filter by inbox category. **Vendor:** `orders`, `inventory`, `account`. ' +
        '**Customer:** `orders`, `payments`, `wallet`, `promotions`, `account`. ' +
        '**Admin:** `account`. Omit to return all categories for the role.',
    },
    isRead: {
      type: 'boolean',
      description: 'When set, return only read (`true`) or unread (`false`) notifications.',
    },
  },
} as const;

const listResponseData = {
  type: 'object',
  properties: {
    notifications: { type: 'array', items: notificationObject },
    total: { type: 'number', description: 'Total rows matching filters' },
    page: { type: 'number' },
    limit: { type: 'number' },
    categories: {
      type: 'array',
      items: { type: 'string', enum: notificationCategoryEnum },
      description: 'Categories valid for the authenticated JWT role (use as `category` filter values).',
    },
  },
} as const;

export const listNotificationsSchema: FastifySchema = {
  tags: ['Notifications'],
  operationId: 'listNotifications',
  summary: 'GET /notifications — inbox history',
  description:
    `**Path:** \`GET /api/v1/notifications\`\n\n` +
    `${INBOX_OVERVIEW}\n\n` +
    `${VENDOR_CATEGORY_DOC}\n\n` +
    `${CUSTOMER_CATEGORY_DOC}\n\n` +
    '**Query filters:** `category`, `isRead`, `page`, `limit`.',
  security: [{ BearerAuth: [] }],
  querystring: listQuerystring,
  response: {
    200: {
      description: 'Paginated inbox for the authenticated user and role',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: listResponseData,
      },
    },
    400: badRequest,
    401: unauthorized,
  },
};

export const unreadCountNotificationsSchema: FastifySchema = {
  tags: ['Notifications'],
  operationId: 'getNotificationUnreadCount',
  summary: 'GET /notifications/unread-count — badge count',
  description:
    `**Path:** \`GET /api/v1/notifications/unread-count\`\n\n` +
    `${INBOX_OVERVIEW}\n\n` +
    'Returns total unread count plus `categories` valid for the JWT role (same list as list endpoint).',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      description: 'Unread count',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            unreadCount: { type: 'number' },
            categories: {
              type: 'array',
              items: { type: 'string', enum: notificationCategoryEnum },
            },
          },
        },
      },
    },
    401: unauthorized,
  },
};

export const markNotificationReadSchema: FastifySchema = {
  tags: ['Notifications'],
  operationId: 'markNotificationRead',
  summary: 'PATCH /notifications/{notificationId}/read — mark one read',
  description:
    `**Path:** \`PATCH /api/v1/notifications/{notificationId}/read\`\n\n` +
    'Marks a single inbox row as read. The notification must belong to the authenticated user and JWT role.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['notificationId'],
    properties: {
      notificationId: { type: 'string', format: 'uuid', description: 'Inbox row UUID' },
    },
  },
  response: {
    200: {
      description: 'Updated notification',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { notification: notificationObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

export const markAllNotificationsReadSchema: FastifySchema = {
  tags: ['Notifications'],
  operationId: 'markAllNotificationsRead',
  summary: 'PATCH /notifications/read-all — mark all read',
  description:
    `**Path:** \`PATCH /api/v1/notifications/read-all\`\n\n` +
    'Marks all unread inbox rows as read for the authenticated user and JWT role.\n\n' +
    'Optional JSON body `{ "category": "orders" }` limits the update to one category ' +
    '(vendor: `orders` | `inventory` | `account`). Empty body marks every unread row.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      category: {
        type: 'string',
        enum: notificationCategoryEnum,
        description:
          'When set, only unread notifications in this category are marked read. ' +
          'Vendor: `orders`, `inventory`, `account`.',
      },
    },
  },
  response: {
    200: {
      description: 'Bulk read result',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            updated: { type: 'number', description: 'Number of inbox rows updated' },
          },
        },
      },
    },
    400: badRequest,
    401: unauthorized,
  },
};
