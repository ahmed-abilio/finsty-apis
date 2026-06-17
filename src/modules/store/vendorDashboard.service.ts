import { QueryTypes } from 'sequelize';
import { Op } from 'sequelize';
import sequelize from '@config/database';
import Product from '@modules/product/product.model';
import { stockStatusWhere } from '@modules/product/productStock.util';
import orderService from '@modules/order/order.service';
import {
  formatUtcDateKey,
  getCurrentMonthRange,
  getLast7DayRanges,
  getMonthBeforePreviousRange,
  getPreviousMonthRange,
  percentChange,
  VENDOR_SALES_ORDER_STATUSES,
  type DateRange,
} from './vendorDashboard.utils';
import { sumLineItemRevenue } from './vendorRevenue.service';
import { formatVendorProduct, vendorProductIncludes, type ProductWithVendorAssocs } from './vendorProductFormat';

async function countDistinctOrders(storeId: string, range: DateRange): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    `SELECT COUNT(DISTINCT o.id) AS count
     FROM orders o
     INNER JOIN order_items oi ON oi.order_id = o.id
     INNER JOIN products p ON p.id = oi.product_id
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
  return Number(rows[0]?.count ?? 0);
}

export interface VendorDashboardData {
  tiles: {
    products: {
      totalProducts: number;
      revenue: { current: number; previous: number; changePercent: number };
    };
    orders: { count: number; changePercent: number };
    lowStockProducts: { count: number };
    outOfStockProducts: { count: number };
  };
  revenue: { lastMonth: number; changePercent: number };
  salesAnalytics: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{
    product: Record<string, unknown>;
    unitsSold: number;
    revenue: number;
  }>;
  recentOrders: unknown[];
}

class VendorDashboardService {
  async getDashboard(storeId: string, vendorId: string): Promise<VendorDashboardData> {
    const now = new Date();
    const currentMonth = getCurrentMonthRange(now);
    const previousMonth = getPreviousMonthRange(now);
    const monthBeforePrevious = getMonthBeforePreviousRange(now);
    const last7Days = getLast7DayRanges(now);

    const [
      totalProducts,
      lowStockCount,
      outOfStockCount,
      revenueCurrentMonth,
      revenuePreviousMonth,
      ordersCurrentMonth,
      ordersPreviousMonth,
      lastMonthRevenue,
      monthBeforePreviousRevenue,
      salesAnalyticsRows,
      topProductRows,
      recentOrdersResult,
    ] = await Promise.all([
      Product.count({ where: { storeId } }),
      Product.count({ where: { storeId, [Op.and]: [stockStatusWhere('low_stock')] } }),
      Product.count({ where: { storeId, [Op.and]: [stockStatusWhere('out_of_stock')] } }),
      sumLineItemRevenue(storeId, currentMonth),
      sumLineItemRevenue(storeId, previousMonth),
      countDistinctOrders(storeId, currentMonth),
      countDistinctOrders(storeId, previousMonth),
      sumLineItemRevenue(storeId, previousMonth),
      sumLineItemRevenue(storeId, monthBeforePrevious),
      Promise.all(
        last7Days.map(async (range) => ({
          date: formatUtcDateKey(range.start),
          revenue: await sumLineItemRevenue(storeId, range),
          orders: await countDistinctOrders(storeId, range),
        })),
      ),
      this.fetchTopProductsByUnits(storeId),
      orderService.listVendorOrders(vendorId, undefined, 1, 5),
    ]);

    const topProducts = await this.loadTopProductDetails(storeId, topProductRows);

    return {
      tiles: {
        products: {
          totalProducts,
          revenue: {
            current: revenueCurrentMonth,
            previous: revenuePreviousMonth,
            changePercent: percentChange(revenueCurrentMonth, revenuePreviousMonth),
          },
        },
        orders: {
          count: ordersCurrentMonth,
          changePercent: percentChange(ordersCurrentMonth, ordersPreviousMonth),
        },
        lowStockProducts: { count: lowStockCount },
        outOfStockProducts: { count: outOfStockCount },
      },
      revenue: {
        lastMonth: lastMonthRevenue,
        changePercent: percentChange(lastMonthRevenue, monthBeforePreviousRevenue),
      },
      salesAnalytics: salesAnalyticsRows,
      topProducts,
      recentOrders: recentOrdersResult.orders,
    };
  }

  private async fetchTopProductsByUnits(
    storeId: string,
  ): Promise<Array<{ productId: string; unitsSold: number; revenue: number }>> {
    const rows = await sequelize.query<{ productId: string; unitsSold: string; revenue: string }>(
      `SELECT oi.product_id AS "productId",
              SUM(oi.quantity)::int AS "unitsSold",
              COALESCE(SUM(oi.total_price), 0) AS revenue
       FROM order_items oi
       INNER JOIN products p ON p.id = oi.product_id
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE p.store_id = :storeId
         AND o.status IN (:statuses)
       GROUP BY oi.product_id
       ORDER BY "unitsSold" DESC
       LIMIT 5`,
      {
        replacements: { storeId, statuses: [...VENDOR_SALES_ORDER_STATUSES] },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((r) => ({
      productId: r.productId,
      unitsSold: Number(r.unitsSold) || 0,
      revenue: parseFloat(Number(r.revenue ?? 0).toFixed(2)),
    }));
  }

  private async loadTopProductDetails(
    storeId: string,
    topRows: Array<{ productId: string; unitsSold: number; revenue: number }>,
  ): Promise<VendorDashboardData['topProducts']> {
    if (!topRows.length) return [];

    const products = await Product.findAll({
      where: { storeId, id: { [Op.in]: topRows.map((r) => r.productId) } },
      include: vendorProductIncludes as never,
    });

    const byId = new Map(products.map((p) => [p.id, p]));

    return topRows
      .map((row) => {
        const product = byId.get(row.productId);
        if (!product) return null;
        return {
          product: formatVendorProduct(product as ProductWithVendorAssocs),
          unitsSold: row.unitsSold,
          revenue: row.revenue,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }
}

export default new VendorDashboardService();
