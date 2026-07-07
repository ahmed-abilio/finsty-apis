'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable('coupons');

    if (columns['ready_to_use']) {
      await queryInterface.sequelize.query(
        'UPDATE coupons SET is_active = false WHERE ready_to_use = false;',
      );
      await queryInterface.removeColumn('coupons', 'ready_to_use');
    }
  },

  async down(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('coupons');

    if (!columns['ready_to_use']) {
      await queryInterface.addColumn('coupons', 'ready_to_use', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      await queryInterface.sequelize.query(
        'UPDATE coupons SET ready_to_use = is_active;',
      );
    }
  },
};
