'use strict';

const { tableExists } = require('../scripts/migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'brands'))) {
      return;
    }

    const columns = await queryInterface.describeTable('brands');
    if (columns.store_id) {
      return;
    }

    // Legacy upgrade path: global brands become store-scoped.
    await queryInterface.sequelize.query('TRUNCATE TABLE brands CASCADE;');

    await queryInterface.sequelize.query(`
      ALTER TABLE brands
        DROP CONSTRAINT IF EXISTS brands_name_key,
        DROP CONSTRAINT IF EXISTS brands_slug_key;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS brands_name;
      DROP INDEX IF EXISTS brands_slug;
    `);

    await queryInterface.addColumn('brands', 'store_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'stores', key: 'id' },
      onDelete: 'CASCADE',
    });

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
    if (!(await tableExists(queryInterface, 'brands'))) {
      return;
    }

    const columns = await queryInterface.describeTable('brands');
    if (!columns.store_id) {
      return;
    }

    await queryInterface.removeIndex('brands', 'brands_name_store_id_unique').catch(() => undefined);
    await queryInterface.removeIndex('brands', 'brands_slug_store_id_unique').catch(() => undefined);
    await queryInterface.removeColumn('brands', 'store_id');

    await queryInterface.addIndex('brands', ['name'], { unique: true, name: 'brands_name' });
    await queryInterface.addIndex('brands', ['slug'], { unique: true, name: 'brands_slug' });
  },
};
