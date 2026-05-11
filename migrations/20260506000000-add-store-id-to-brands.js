'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Truncate existing global brands — they cannot be assigned to a store retroactively
    await queryInterface.sequelize.query('TRUNCATE TABLE brands CASCADE;');

    // Drop unique constraints on name and slug (they become store-scoped)
    await queryInterface.sequelize.query(`
      ALTER TABLE brands
        DROP CONSTRAINT IF EXISTS brands_name_key,
        DROP CONSTRAINT IF EXISTS brands_slug_key;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS brands_name;
      DROP INDEX IF EXISTS brands_slug;
    `);

    // Add store_id column
    await queryInterface.addColumn('brands', 'store_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'stores', key: 'id' },
      onDelete: 'CASCADE',
    });

    // Composite unique indexes scoped per store
    await queryInterface.addIndex('brands', ['name', 'store_id'], {
      unique: true,
      name: 'brands_name_store_id_unique',
    });
    await queryInterface.addIndex('brands', ['slug', 'store_id'], {
      unique: true,
      name: 'brands_slug_store_id_unique',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeIndex('brands', 'brands_name_store_id_unique');
    await queryInterface.removeIndex('brands', 'brands_slug_store_id_unique');
    await queryInterface.removeColumn('brands', 'store_id');

    await queryInterface.addIndex('brands', ['name'], { unique: true, name: 'brands_name' });
    await queryInterface.addIndex('brands', ['slug'], { unique: true, name: 'brands_slug' });
  },
};
