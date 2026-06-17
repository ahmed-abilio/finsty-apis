'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('order_items');

    if (!columns['base_price']) {
      await queryInterface.addColumn('order_items', 'base_price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    if (!columns['discount_percent']) {
      await queryInterface.addColumn('order_items', 'discount_percent', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      });
    }

    if (!columns['discount_amount']) {
      await queryInterface.addColumn('order_items', 'discount_amount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    if (!columns['discounted_base_price']) {
      await queryInterface.addColumn('order_items', 'discounted_base_price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    if (!columns['additional_price']) {
      await queryInterface.addColumn('order_items', 'additional_price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('order_items');

    if (columns['additional_price']) {
      await queryInterface.removeColumn('order_items', 'additional_price');
    }

    if (columns['discounted_base_price']) {
      await queryInterface.removeColumn('order_items', 'discounted_base_price');
    }

    if (columns['discount_amount']) {
      await queryInterface.removeColumn('order_items', 'discount_amount');
    }

    if (columns['discount_percent']) {
      await queryInterface.removeColumn('order_items', 'discount_percent');
    }

    if (columns['base_price']) {
      await queryInterface.removeColumn('order_items', 'base_price');
    }
  },
};
