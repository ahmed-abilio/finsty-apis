import { QueryTypes } from 'sequelize';
import sequelize from '@config/database';
import type { PaymentStatus } from '@modules/payment/payment.model';
import type { OrderStatus } from '@modules/order/order.model';
import { ORDER_STATUS_VALUES } from '@modules/order/order-status.constants';
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
  id: 'orders' | 'revenue' | 'aov' | 'fulfillment-rate' | 'new-users' | 'new-stores';
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

export interface OrderStatusSummaryRow {
  status: OrderStatus;
  count: number;
  amount: number;
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
  orderStatus: {
    summary: OrderStatusSummaryRow[];
  };
  recentActivity: DashboardActivityItem[];
}

export interface DeliveryAnalyticsCluster {
  pincode: string;
  orderCount: number;
  avgDeliveryHours: number | null;
  avgDeliveryMinutes: number | null;
}

export interface DeliveryAnalyticsData {
  period: { from: string; to: string };
  summary: {
    totalDeliveredOrders: number;
    pincodeCount: number;
    avgDeliveryHours: number | null;
  };
  clusters: DeliveryAnalyticsCluster[];
}

async function countOrders(range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM orders
     WHERE "createdAt" >= :start AND "createdAt" <= :end`,
    { replacements: { start: range.start, end: range.end }, type: QueryTypes.SELECT },
  );
  return Number(rows[0]?.count ?? 0);
}

async function countOrdersByStatuses(
  range: DateRange,
  statuses: readonly string[],
): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM orders
     WHERE status IN (:statuses)
       AND "createdAt" >= :start AND "createdAt" <= :end`,
    {
      replacements: { statuses: [...statuses], start: range.start, end: range.end },
      type: QueryTypes.SELECT,
    },
  );
  return Number(rows[0]?.count ?? 0);
}

/** AOV = captured revenue / order count (0 when no orders). */
function computeAov(revenue: number, orderCount: number): number {
  if (orderCount <= 0) return 0;
  return parseFloat((revenue / orderCount).toFixed(2));
}

/**
 * Fulfillment rate = delivered / (delivered + cancelled + returned) * 100.
 * 0 when no terminal outcomes in range.
 */
function computeFulfillmentRate(
  delivered: number,
  cancelled: number,
  returned: number,
): number {
  const denom = delivered + cancelled + returned;
  if (denom <= 0) return 0;
  return parseFloat(((delivered / denom) * 100).toFixed(2));
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

async function fetchOrderStatusSummary(range: DateRange): Promise<OrderStatusSummaryRow[]> {
  const rows = await sequelize.query<{ status: OrderStatus; count: string; amount: string }>(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS amount
     FROM orders
     WHERE "createdAt" >= :start AND "createdAt" <= :end
     GROUP BY status`,
    { replacements: { start: range.start, end: range.end }, type: QueryTypes.SELECT },
  );
  const byStatus = new Map(rows.map((r) => [r.status, r]));
  return ORDER_STATUS_VALUES.map((status) => {
    const row = byStatus.get(status);
    return {
      status,
      count: Number(row?.count ?? 0),
      amount: parseFloat(Number(row?.amount ?? 0).toFixed(2)),
    };
  });
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
      deliveredCurrent,
      cancelledCurrent,
      returnedCurrent,
      deliveredPrevious,
      cancelledPrevious,
      returnedPrevious,
      usersCurrent,
      usersPrevious,
      storesCurrent,
      storesPrevious,
      paymentSummary,
      paymentTimeline,
      orderSummary,
      recentActivity,
    ] = await Promise.all([
      countOrders(range),
      countOrders(previous),
      sumCapturedRevenue(range),
      sumCapturedRevenue(previous),
      countOrdersByStatuses(range, ['delivered']),
      countOrdersByStatuses(range, ['cancelled']),
      countOrdersByStatuses(range, ['returned']),
      countOrdersByStatuses(previous, ['delivered']),
      countOrdersByStatuses(previous, ['cancelled']),
      countOrdersByStatuses(previous, ['returned']),
      countNewUsers(range),
      countNewUsers(previous),
      countNewStores(range),
      countNewStores(previous),
      fetchPaymentStatusSummary(range),
      fetchPaymentStatusTimeline(range),
      fetchOrderStatusSummary(range),
      fetchRecentActivity(),
    ]);

    const aovCurrent = computeAov(revenueCurrent, ordersCurrent);
    const aovPrevious = computeAov(revenuePrevious, ordersPrevious);
    const fulfillmentCurrent = computeFulfillmentRate(
      deliveredCurrent,
      cancelledCurrent,
      returnedCurrent,
    );
    const fulfillmentPrevious = computeFulfillmentRate(
      deliveredPrevious,
      cancelledPrevious,
      returnedPrevious,
    );

    return {
      range: {
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      },
      stats: [
        buildStat('orders', 'Orders', ordersCurrent, ordersPrevious),
        buildStat('revenue', 'Revenue', revenueCurrent, revenuePrevious),
        buildStat('aov', 'AOV', aovCurrent, aovPrevious),
        buildStat('fulfillment-rate', 'Fulfillment rate', fulfillmentCurrent, fulfillmentPrevious),
        buildStat('new-users', 'New Users', usersCurrent, usersPrevious),
        buildStat('new-stores', 'New Stores', storesCurrent, storesPrevious),
      ],
      paymentStatus: {
        summary: paymentSummary,
        timeline: paymentTimeline,
      },
      orderStatus: {
        summary: orderSummary,
      },
      recentActivity,
    };
  }

  async getDeliveryAnalytics(range: DateRange): Promise<DeliveryAnalyticsData> {
    const rows = await sequelize.query<{
      pincode: string;
      order_count: string;
      avg_delivery_hours: string | null;
    }>(
      `SELECT
         a.postal_code AS pincode,
         COUNT(DISTINCT o.id)::text AS order_count,
         AVG(EXTRACT(EPOCH FROM (o.delivered_at - o."createdAt")) / 3600.0) AS avg_delivery_hours
       FROM orders o
       INNER JOIN addresses a ON a.id = o.address_id
       WHERE o.delivery_type = 'delivery'
         AND o.status = 'delivered'
         AND o.delivered_at IS NOT NULL
         AND a.postal_code IS NOT NULL
         AND TRIM(a.postal_code) <> ''
         AND o."createdAt" >= :start
         AND o."createdAt" <= :end
       GROUP BY a.postal_code
       ORDER BY COUNT(DISTINCT o.id) DESC, a.postal_code ASC`,
      {
        replacements: { start: range.start, end: range.end },
        type: QueryTypes.SELECT,
      },
    );

    const clusters: DeliveryAnalyticsCluster[] = rows.map((row) => {
      const orderCount = Number(row.order_count) || 0;
      const avgHours =
        row.avg_delivery_hours == null || Number.isNaN(Number(row.avg_delivery_hours))
          ? null
          : parseFloat(Number(row.avg_delivery_hours).toFixed(2));
      return {
        pincode: row.pincode,
        orderCount,
        avgDeliveryHours: avgHours,
        avgDeliveryMinutes:
          avgHours == null ? null : parseFloat((avgHours * 60).toFixed(1)),
      };
    });

    const totalDeliveredOrders = clusters.reduce((sum, c) => sum + c.orderCount, 0);
    let weightedHours = 0;
    let weight = 0;
    for (const c of clusters) {
      if (c.avgDeliveryHours != null && c.orderCount > 0) {
        weightedHours += c.avgDeliveryHours * c.orderCount;
        weight += c.orderCount;
      }
    }

    return {
      period: {
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      },
      summary: {
        totalDeliveredOrders,
        pincodeCount: clusters.length,
        avgDeliveryHours: weight > 0 ? parseFloat((weightedHours / weight).toFixed(2)) : null,
      },
      clusters,
    };
  }
}

export default new DashboardService();
