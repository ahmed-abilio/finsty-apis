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
