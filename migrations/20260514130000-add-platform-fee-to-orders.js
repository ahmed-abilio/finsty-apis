'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('orders');
    if (!cols.platform_fee) {
      await queryInterface.addColumn('orders', 'platform_fee', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('orders');
    if (cols.platform_fee) {
      await queryInterface.removeColumn('orders', 'platform_fee');
    }
  },
};
