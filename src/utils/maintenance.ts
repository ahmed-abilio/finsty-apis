import { generateSlug } from './slugify';
import logger from './logger';

/**
 * Fixes missing slugs in the database for models that require unique slugs.
 * This is useful when adding a unique slug constraint to existing data.
 */
export async function fixMissingSlugs(sequelize: any) {
  const tables = [
    { tableName: 'brands', name: 'Brand' },
    { tableName: 'stores', name: 'Store' },
    { tableName: 'products', name: 'Product' },
  ];

  for (const { tableName, name } of tables) {
    try {
      // Check if table exists
      const [tableExists] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}'
        );
      `);

      if (!tableExists[0].exists) continue;

      // Check if slug column exists
      const [columnExists] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}' 
          AND column_name = 'slug'
        );
      `);

      if (!columnExists[0].exists) continue;

      // Find records with empty slugs using raw SQL to avoid model dependency issues
      const [records] = await sequelize.query(`
        SELECT id, name FROM ${tableName} WHERE slug = '' OR slug IS NULL
      `);

      if (records.length > 0) {
        logger.info(`Fixing ${records.length} missing slugs for ${name} (${tableName})...`);

        for (const record of records as any[]) {
          const baseName = record.name || 'unnamed';
          const suffix = record.id ? record.id.toString().split('-')[0] : Math.random().toString(36).substring(2, 6);
          const newSlug = `${generateSlug(baseName)}-${suffix}`;
          
          await sequelize.query(`UPDATE ${tableName} SET slug = ? WHERE id = ?`, {
            replacements: [newSlug, record.id],
          });
        }
        
        logger.info(`Successfully fixed slugs for ${name}`);
      }
    } catch (error) {
      logger.error(`Error fixing slugs for ${name}:`, error);
    }
  }
}

/**
 * Removes legacy global unique indexes on brand name/slug and keeps only
 * store-scoped uniqueness so the same brand name can exist in different stores.
 */
export async function fixBrandConstraints(sequelize: any) {
  try {
    const [legacyConstraints]: any = await sequelize.query(`
      SELECT c.conname AS constraint_name
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'brands'
        AND c.contype = 'u'
        AND c.conname <> 'brands_pkey'
        AND pg_get_constraintdef(c.oid) NOT LIKE '%store_id%'
    `);

    for (const { constraint_name } of legacyConstraints) {
      logger.info(`Dropping legacy global brand constraint '${constraint_name}'`);
      await sequelize.query(`ALTER TABLE brands DROP CONSTRAINT IF EXISTS "${constraint_name}"`);
    }

    if (legacyConstraints.length > 0) {
      logger.info(
        `Dropped ${legacyConstraints.length} legacy global brand constraint(s). Brand names are unique per store only.`,
      );
    }

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS brands_name_store_id_unique
        ON brands (name, store_id);
      CREATE UNIQUE INDEX IF NOT EXISTS brands_slug_store_id_unique
        ON brands (slug, store_id);
    `);
  } catch (error) {
    logger.error('Error while fixing brand unique constraints:', error);
  }
}

/**
 * Ensures `orders.order_id` exists and is fully usable in environments where
 * model sync/migrations are not run automatically.
 */
export async function ensureOrderIdColumn(sequelize: any) {
  try {
    const [ordersTableExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'orders'
      );
    `);

    if (!ordersTableExists[0].exists) return;

    await sequelize.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_id VARCHAR(12);
    `);

    // Backfill old rows so NOT NULL + unique index can be safely applied.
    await sequelize.query(`
      UPDATE orders
      SET order_id = 'FI' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 10))
      WHERE order_id IS NULL OR order_id = '';
    `);

    await sequelize.query(`
      ALTER TABLE orders
      ALTER COLUMN order_id SET NOT NULL;
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_order_id_unique_idx
      ON orders (order_id);
    `);

    logger.info('Ensured orders.order_id column and unique index');
  } catch (error) {
    logger.error('Error while ensuring orders.order_id column:', error);
  }
}

/**
 * Ensures `product_variants.size_chart` exists in environments where
 * model sync/migrations are not run automatically.
 */
export async function ensureVariantSizeChartColumn(sequelize: any) {
  try {
    const [variantsTableExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'product_variants'
      );
    `);

    if (!variantsTableExists[0].exists) return;

    await sequelize.query(`
      ALTER TABLE product_variants
      ADD COLUMN IF NOT EXISTS size_chart VARCHAR(2048);
    `);

    logger.info('Ensured product_variants.size_chart column');
  } catch (error) {
    logger.error('Error while ensuring product_variants.size_chart column:', error);
  }
}
