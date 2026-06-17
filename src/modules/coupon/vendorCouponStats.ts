import { QueryTypes } from 'sequelize';
import sequelize from '@config/database';
import {
  VENDOR_SALES_ORDER_STATUSES,
  type DateRange,
} from '@modules/store/vendorDashboard.utils';

export interface VendorCouponStats {
  totalCoupons: number;
  activeCount: number;
  inactiveCount: number;
  usedCount: number;
  totalDiscountAmount: number;
}

export async function fetchVendorCouponStats(
  storeId: string,
  range?: DateRange,
): Promise<VendorCouponStats> {
  const countRows = await sequelize.query<{
    totalCoupons: number;
    activeCount: number;
    inactiveCount: number;
  }>(
    `SELECT
      COUNT(*)::int AS "totalCoupons",
      COUNT(*) FILTER (WHERE is_active = true)::int AS "activeCount",
      COUNT(*) FILTER (WHERE is_active = false)::int AS "inactiveCount"
    FROM coupons
    WHERE store_id = :storeId`,
    { replacements: { storeId }, type: QueryTypes.SELECT },
  );

  const dateClause = range
    ? ` AND o."createdAt" >= :rangeStart AND o."createdAt" <= :rangeEnd`
    : '';

  const usageReplacements: Record<string, unknown> = {
    storeId,
    statuses: [...VENDOR_SALES_ORDER_STATUSES],
  };
  if (range) {
    usageReplacements.rangeStart = range.start;
    usageReplacements.rangeEnd = range.end;
  }

  const usageRows = await sequelize.query<{
    usedCount: number;
    totalDiscountAmount: string;
  }>(
    `SELECT
      COUNT(cu.id)::int AS "usedCount",
      COALESCE(SUM(
        (
          SELECT (elem->>'discountAmount')::numeric
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(o.metadata->'appliedCoupons') = 'array'
                 THEN o.metadata->'appliedCoupons'
                 ELSE '[]'::jsonb END
          ) elem
          WHERE (elem->>'couponId')::uuid = cu.coupon_id
          LIMIT 1
        )
      ), 0) AS "totalDiscountAmount"
    FROM coupon_usages cu
    INNER JOIN coupons c ON c.id = cu.coupon_id
    INNER JOIN orders o ON o.id = cu.order_id
    WHERE c.store_id = :storeId
      AND o.status IN (:statuses)${dateClause}`,
    { replacements: usageReplacements, type: QueryTypes.SELECT },
  );

  const counts = countRows[0];
  const usage = usageRows[0];

  return {
    totalCoupons: Number(counts?.totalCoupons ?? 0),
    activeCount: Number(counts?.activeCount ?? 0),
    inactiveCount: Number(counts?.inactiveCount ?? 0),
    usedCount: Number(usage?.usedCount ?? 0),
    totalDiscountAmount: parseFloat(Number(usage?.totalDiscountAmount ?? 0).toFixed(2)),
  };
}
