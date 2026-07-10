const paymentStatusEnum = ['pending', 'captured', 'failed', 'refund_requested', 'refunded'] as const;
const orderStatusEnum = [
  'pending',
  'confirmed',
  'rider_assigned',
  'at_store',
  'picked_up',
  'arrived',
  'delivered',
  'cancelled',
  'returned',
] as const;

const dashboardStatSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', enum: ['orders', 'revenue', 'new-users', 'new-stores'] },
    label: { type: 'string' },
    value: { type: 'number' },
    change: { type: 'number', description: 'Percent change vs previous equal-length period' },
    changeLabel: { type: 'string' },
  },
};

const paymentSummarySchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: [...paymentStatusEnum] },
    count: { type: 'number' },
    amount: { type: 'number' },
  },
};

const orderSummarySchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: [...orderStatusEnum] },
    count: { type: 'number' },
    amount: { type: 'number', description: 'Sum of order total_amount for this status' },
  },
};

const paymentTimelineSchema = {
  type: 'object',
  properties: {
    date: { type: 'string', description: 'YYYY-MM-DD (UTC)' },
    pending: { type: 'number' },
    captured: { type: 'number' },
    failed: { type: 'number' },
    refund_requested: { type: 'number' },
    refunded: { type: 'number' },
  },
};

const activitySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userName: { type: 'string' },
    action: { type: 'string' },
    target: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
  },
};

export const getAdminDashboardSchema = {
  tags: ['Admin dashboard'],
  summary: 'Admin platform dashboard',
  description:
    'KPI stats, payment and order status breakdown, and recent activity for the selected date range. ' +
    'Defaults to the last 30 days when from/to are omitted.',
  querystring: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Start date (ISO or YYYY-MM-DD). Defaults with to to last 30 days.' },
      to: { type: 'string', description: 'End date (ISO or YYYY-MM-DD). Defaults with from to last 30 days.' },
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
            range: {
              type: 'object',
              properties: {
                from: { type: 'string', format: 'date-time' },
                to: { type: 'string', format: 'date-time' },
              },
            },
            stats: { type: 'array', items: dashboardStatSchema },
            paymentStatus: {
              type: 'object',
              properties: {
                summary: { type: 'array', items: paymentSummarySchema },
                timeline: { type: 'array', items: paymentTimelineSchema },
              },
            },
            orderStatus: {
              type: 'object',
              properties: {
                summary: { type: 'array', items: orderSummarySchema },
              },
            },
            recentActivity: { type: 'array', items: activitySchema },
          },
        },
      },
    },
  },
};
