'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('products');

    if (!columns['status']) {
      await queryInterface.addColumn('products', 'status', {
        type: Sequelize.ENUM('draft', 'active'),
        allowNull: false,
        defaultValue: 'active',
      });

      await queryInterface.addIndex('products', ['store_id', 'status'], {
        name: 'products_store_id_status_idx',
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('products');

    if (columns['status']) {
      await queryInterface.removeIndex('products', 'products_store_id_status_idx');
      await queryInterface.removeColumn('products', 'status');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_products_status";');
    }
  },
};
