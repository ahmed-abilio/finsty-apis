import { QueryTypes } from 'sequelize';
import sequelize from '@config/database';
import type { PaymentStatus } from '@modules/payment/payment.model';
import { Roles } from '@modules/user/user.model';
import {
  enumerateUtcDateKeys,
  formatUtcDateKey,
  getPreviousPeriodRange,
  percentChange,
  type DateRange,
} from './dashboard.utils';

const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'captured',
  'failed',
  'refund_requested',
  'refunded',
];

export interface DashboardStat {
  id: 'orders' | 'revenue' | 'new-users' | 'new-stores';
  label: string;
  value: number;
  change: number;
  changeLabel: string;
}

export interface PaymentStatusSummaryRow {
  status: PaymentStatus;
  count: number;
  amount: number;
}

export interface PaymentStatusTimelinePoint {
  date: string;
  pending: number;
  captured: number;
  failed: number;
  refund_requested: number;
  refunded: number;
}

export interface DashboardActivityItem {
  id: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface AdminDashboardData {
  range: { from: string; to: string };
  stats: DashboardStat[];
  paymentStatus: {
    summary: PaymentStatusSummaryRow[];
    timeline: PaymentStatusTimelinePoint[];
  };
  recentActivity: DashboardActivityItem[];
}

async function countOrders(range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM orders
     WHERE "createdAt" >= :start AND "createdAt" <= :end`,
    { replacements: { start: range.start, end: range.end }, type: QueryTypes.SELECT },
  );
  return Number(rows[0]?.count ?? 0);
}

async function sumCapturedRevenue(range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
     WHERE status = 'captured'
       AND "createdAt" >= :start AND "createdAt" <= :end`,
    { replacements: { start: range.start, end: range.end }, type: QueryTypes.SELECT },
  );
  return parseFloat(Number(rows[0]?.total ?? 0).toFixed(2));
}

async function countNewUsers(range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM user_users
     WHERE role = :role
       AND "createdAt" >= :start AND "createdAt" <= :end`,
    {
      replacements: { role: Roles.USER, start: range.start, end: range.end },
      type: QueryTypes.SELECT,
    },
  );
  return Number(rows[0]?.count ?? 0);
}

async function countNewStores(range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM stores
     WHERE "createdAt" >= :start AND "createdAt" <= :end`,
    { replacements: { start: range.start, end: range.end }, type: QueryTypes.SELECT },
  );
  return Number(rows[0]?.count ?? 0);
}

async function fetchPaymentStatusSummary(range: DateRange): Promise<PaymentStatusSummaryRow[]> {
  const rows = await sequelize.query<{ status: PaymentStatus; count: string; amount: string }>(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
     FROM payments
     WHERE "createdAt" >= :start AND "createdAt" <= :end
     GROUP BY status`,
    { replacements: { start: range.start, end: range.end }, type: QueryTypes.SELECT },
  );
  const byStatus = new Map(rows.map((r) => [r.status, r]));
  return PAYMENT_STATUSES.map((status) => {
    const row = byStatus.get(status);
    return {
      status,
      count: Number(row?.count ?? 0),
      amount: parseFloat(Number(row?.amount ?? 0).toFixed(2)),
    };
  });
}

async function fetchPaymentStatusTimeline(range: DateRange): Promise<PaymentStatusTimelinePoint[]> {
  const rows = await sequelize.query<{ day: Date; status: PaymentStatus; count: string }>(
    `SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, status, COUNT(*) AS count
     FROM payments
     WHERE "createdAt" >= :start AND "createdAt" <= :end
     GROUP BY day, status
     ORDER BY day ASC`,
    { replacements: { start: range.start, end: range.end }, type: QueryTypes.SELECT },
  );

  const dateKeys = enumerateUtcDateKeys(range);
  const byDate = new Map<string, PaymentStatusTimelinePoint>();
  for (const date of dateKeys) {
    byDate.set(date, {
      date,
      pending: 0,
      captured: 0,
      failed: 0,
      refund_requested: 0,
      refunded: 0,
    });
  }

  for (const row of rows) {
    const date = formatUtcDateKey(new Date(row.day));
    const point = byDate.get(date);
    if (point && row.status in point) {
      point[row.status as keyof Omit<PaymentStatusTimelinePoint, 'date'>] = Number(row.count ?? 0);
    }
  }

  return dateKeys.map((date) => byDate.get(date)!);
}

async function fetchRecentActivity(): Promise<DashboardActivityItem[]> {
  const [orderRows, storeRows] = await Promise.all([
    sequelize.query<{
      id: string;
      order_id: string;
      user_name: string | null;
      user_phone: string | null;
      created_at: Date;
    }>(
      `SELECT o.id, o.order_id, u.name AS user_name, u.phone AS user_phone, o."createdAt" AS created_at
       FROM orders o
       LEFT JOIN user_users u ON u.id = o.user_id
       ORDER BY o."createdAt" DESC
       LIMIT 8`,
      { type: QueryTypes.SELECT },
    ),
    sequelize.query<{
      id: string;
      name: string;
      created_at: Date;
    }>(
      `SELECT id, name, "createdAt" AS created_at
       FROM stores
       WHERE onboarding_status = 'PENDING'
       ORDER BY "createdAt" DESC
       LIMIT 8`,
      { type: QueryTypes.SELECT },
    ),
  ]);

  const orderActivity: DashboardActivityItem[] = orderRows.map((row) => ({
    id: `order-${row.id}`,
    userName: row.user_name?.trim() || row.user_phone || 'Customer',
    action: 'placed order',
    target: row.order_id,
    timestamp: new Date(row.created_at).toISOString(),
  }));

  const storeActivity: DashboardActivityItem[] = storeRows.map((row) => ({
    id: `store-${row.id}`,
    userName: 'Vendor',
    action: 'applied for store',
    target: row.name,
    timestamp: new Date(row.created_at).toISOString(),
  }));

  return [...orderActivity, ...storeActivity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
}

function buildStat(
  id: DashboardStat['id'],
  label: string,
  current: number,
  previous: number,
): DashboardStat {
  return {
    id,
    label,
    value: current,
    change: percentChange(current, previous),
    changeLabel: 'vs previous period',
  };
}

class DashboardService {
  async getDashboard(range: DateRange): Promise<AdminDashboardData> {
    const previous = getPreviousPeriodRange(range);

    const [
      ordersCurrent,
      ordersPrevious,
      revenueCurrent,
      revenuePrevious,
      usersCurrent,
      usersPrevious,
      storesCurrent,
      storesPrevious,
      paymentSummary,
      paymentTimeline,
      recentActivity,
    ] = await Promise.all([
      countOrders(range),
      countOrders(previous),
      sumCapturedRevenue(range),
      sumCapturedRevenue(previous),
      countNewUsers(range),
      countNewUsers(previous),
      countNewStores(range),
      countNewStores(previous),
      fetchPaymentStatusSummary(range),
      fetchPaymentStatusTimeline(range),
      fetchRecentActivity(),
    ]);

    return {
      range: {
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      },
      stats: [
        buildStat('orders', 'Orders', ordersCurrent, ordersPrevious),
        buildStat('revenue', 'Revenue', revenueCurrent, revenuePrevious),
        buildStat('new-users', 'New Users', usersCurrent, usersPrevious),
        buildStat('new-stores', 'New Stores', storesCurrent, storesPrevious),
      ],
      paymentStatus: {
        summary: paymentSummary,
        timeline: paymentTimeline,
      },
      recentActivity,
    };
  }
}

export default new DashboardService();
