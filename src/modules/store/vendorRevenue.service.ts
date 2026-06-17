import { QueryTypes } from 'sequelize';
import sequelize from '@config/database';
import orderService from '@modules/order/order.service';
import {
  percentChange,
  getPreviousPeriodRange,
  VENDOR_SALES_ORDER_STATUSES,
  type DateRange,
} from './vendorDashboard.utils';

export async function sumLineItemRevenue(storeId: string, range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ total: string }>(
    `SELECT COALESCE(SUM(oi.total_price), 0) AS total
     FROM order_items oi
     INNER JOIN products p ON p.id = oi.product_id
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE p.store_id = :storeId
       AND o.status IN (:statuses)
       AND o."createdAt" >= :start
       AND o."createdAt" <= :end`,
    {
      replacements: {
        storeId,
        statuses: [...VENDOR_SALES_ORDER_STATUSES],
        start: range.start,
        end: range.end,
      },
      type: QueryTypes.SELECT,
    },
  );
  return parseFloat(Number(rows[0]?.total ?? 0).toFixed(2));
}

export async function sumOrderPlatformFees(storeId: string, range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ total: string }>(
    `SELECT COALESCE(SUM(sub.platform_fee), 0) AS total
     FROM (
       SELECT DISTINCT o.id, o.platform_fee
       FROM orders o
       INNER JOIN order_items oi ON oi.order_id = o.id
       INNER JOIN products p ON p.id = oi.product_id
       WHERE p.store_id = :storeId
         AND o.status IN (:statuses)
         AND o."createdAt" >= :start
         AND o."createdAt" <= :end
     ) sub`,
    {
      replacements: {
        storeId,
        statuses: [...VENDOR_SALES_ORDER_STATUSES],
        start: range.start,
        end: range.end,
      },
      type: QueryTypes.SELECT,
    },
  );
  return parseFloat(Number(rows[0]?.total ?? 0).toFixed(2));
}

export interface VendorRevenueMetricTile {
  current: number;
  previous: number;
  changePercent: number;
}

export interface VendorRevenueData {
  period: { from: string; to: string };
  tiles: {
    totalEarnings: VendorRevenueMetricTile;
    commission: VendorRevenueMetricTile;
    actualPayment: VendorRevenueMetricTile;
  };
  orders: {
    total: number;
    page: number;
    limit: number;
    items: unknown[];
  };
}

function buildMetricTile(current: number, previous: number): VendorRevenueMetricTile {
  return {
    current,
    previous,
    changePercent: percentChange(current, previous),
  };
}

class VendorRevenueService {
  async getRevenue(
    storeId: string,
    vendorId: string,
    range: DateRange,
    page = 1,
    limit = 20,
  ): Promise<VendorRevenueData> {
    const current = range;
    const previous = getPreviousPeriodRange(current);

    const [
      earningsCurrent,
      earningsPrevious,
      commissionCurrent,
      commissionPrevious,
      ordersResult,
    ] = await Promise.all([
      sumLineItemRevenue(storeId, current),
      sumLineItemRevenue(storeId, previous),
      sumOrderPlatformFees(storeId, current),
      sumOrderPlatformFees(storeId, previous),
      orderService.listVendorOrdersInRange(vendorId, current, page, limit),
    ]);

    const actualPaymentCurrent = parseFloat((earningsCurrent - commissionCurrent).toFixed(2));
    const actualPaymentPrevious = parseFloat((earningsPrevious - commissionPrevious).toFixed(2));

    return {
      period: {
        from: current.start.toISOString(),
        to: current.end.toISOString(),
      },
      tiles: {
        totalEarnings: buildMetricTile(earningsCurrent, earningsPrevious),
        commission: buildMetricTile(commissionCurrent, commissionPrevious),
        actualPayment: buildMetricTile(actualPaymentCurrent, actualPaymentPrevious),
      },
      orders: {
        total: ordersResult.total,
        page: ordersResult.page,
        limit: ordersResult.limit,
        items: ordersResult.orders,
      },
    };
  }
}

export default new VendorRevenueService();
