import { col, fn, literal, Transaction, WhereOptions } from 'sequelize';
import Product from './product.model';
import ProductVariant from './product-variant.model';

export type ProductStockStatus = 'in_stock' | 'out_of_stock' | 'low_stock';

/** Sum of all variant stock rows for a product (Sequelize `Product` alias in queries). */
const VARIANT_STOCK_SUM_SQL = `COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = "Product"."id"), 0)`;

export function stockStatusWhere(stockStatus: ProductStockStatus): WhereOptions {
  switch (stockStatus) {
    case 'out_of_stock':
      return literal(`${VARIANT_STOCK_SUM_SQL} = 0`);
    case 'low_stock':
      return literal(
        `${VARIANT_STOCK_SUM_SQL} > 0 AND ${VARIANT_STOCK_SUM_SQL} <= "Product"."low_stock_threshold"`,
      );
    case 'in_stock':
      return literal(`${VARIANT_STOCK_SUM_SQL} > "Product"."low_stock_threshold"`);
  }
}

/** Keeps `inStock` / `lowStockAlert` aligned with summed variant stock. */
export async function syncProductStockFromVariants(
  productId: string,
  transaction?: Transaction,
): Promise<void> {
  const product = await Product.findByPk(productId, { transaction });
  if (!product) return;

  const row = (await ProductVariant.findOne({
    attributes: [[fn('COALESCE', fn('SUM', col('stock')), 0), 'totalStock']],
    where: { productId },
    raw: true,
    transaction,
  })) as { totalStock?: string | number } | null;

  const totalStock = Number(row?.totalStock ?? 0);
  const threshold = Number(product.lowStockThreshold ?? 10);
  const inStock = totalStock > 0;
  const lowStockAlert = inStock && totalStock <= threshold;

  if (product.inStock !== inStock || product.lowStockAlert !== lowStockAlert) {
    await product.update({ inStock, lowStockAlert }, { transaction });
  }
}
