'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('coupons');

    if (!columns['ready_to_use']) {
      await queryInterface.addColumn('coupons', 'ready_to_use', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('coupons');

    if (columns['ready_to_use']) {
      await queryInterface.removeColumn('coupons', 'ready_to_use');
    }
  },
};
