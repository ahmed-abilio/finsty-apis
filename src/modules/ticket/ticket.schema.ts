import type { FastifySchema } from 'fastify';

// ─── Shared error shapes ──────────────────────────────────────────────────────

const unauthorized = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const forbidden = {
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

// ─── Reusable domain objects ──────────────────────────────────────────────────

const ticketObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    raisedById: { type: 'string', format: 'uuid' },
    storeId: { type: 'string', format: 'uuid', nullable: true },
    description: { type: 'string' },
    imageUrl: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'] },
    type: { type: 'string', enum: ['USER_TO_STORE', 'VENDOR_TO_ADMIN'] },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
    raisedBy: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        profileImage: { type: 'string', nullable: true },
      },
    },
    store: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        logoUrl: { type: 'string', nullable: true },
      },
    },
  },
} as const;

const paginationMeta = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    page: { type: 'number' },
    limit: { type: 'number' },
    totalPages: { type: 'number' },
  },
} as const;

// ─── POST /tickets ────────────────────────────────────────────────────────────

export const createTicketSchema: FastifySchema = {
  tags: ['Tickets'],
  summary: 'Raise a support ticket',
  description:
    'Users raise a ticket to a store (USER_TO_STORE). Vendors raise a ticket to admin (VENDOR_TO_ADMIN). The type is inferred from the caller role; users must provide storeId.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['description'],
    properties: {
      storeId: {
        type: 'string',
        format: 'uuid',
        description: 'Required when the caller is a user (USER_TO_STORE ticket)',
      },
      description: {
        type: 'string',
        minLength: 1,
        maxLength: 5000,
        description: 'Ticket description text',
      },
      imageUrl: {
        type: 'string',
        format: 'uri',
        description: 'Optional S3 URL of an attached image',
      },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Ticket created',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { ticket: ticketObject } },
      },
    },
    400: badRequest,
    401: unauthorized,
  },
};

// ─── GET /tickets/raised ──────────────────────────────────────────────────────

export const getMyTicketsSchema: FastifySchema = {
  tags: ['Tickets'],
  summary: 'List tickets raised by the current user/vendor',
  description: 'Returns all tickets raised by the authenticated caller, newest first.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      description: 'Paginated ticket list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: ticketObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
  },
};

// ─── GET /tickets/store ───────────────────────────────────────────────────────

export const getStoreTicketsSchema: FastifySchema = {
  tags: ['Tickets'],
  summary: 'List tickets raised to the vendor store',
  description:
    'Vendor-only. Returns all USER_TO_STORE tickets that were raised against the authenticated vendor store.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      description: 'Paginated ticket list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: ticketObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
    403: forbidden,
  },
};

// ─── GET /tickets/admin ───────────────────────────────────────────────────────

export const getAdminTicketsSchema: FastifySchema = {
  tags: ['Admin — Tickets'],
  summary: 'List all vendor-to-admin tickets',
  description: 'Admin-only. Returns all VENDOR_TO_ADMIN tickets, newest first.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'] },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      description: 'Paginated ticket list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: ticketObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
    403: forbidden,
  },
};

// ─── PATCH /tickets/:ticketId/status ──────────────────────────────────────────

export const updateTicketStatusSchema: FastifySchema = {
  tags: ['Tickets'],
  summary: 'Update ticket status',
  description:
    'Vendors can update status of tickets raised to their store. Admins can update status of VENDOR_TO_ADMIN tickets.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['ticketId'],
    properties: { ticketId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'] },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Ticket status updated',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { ticket: ticketObject } },
      },
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};
