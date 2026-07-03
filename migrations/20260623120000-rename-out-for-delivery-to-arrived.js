'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE orders SET status = 'arrived' WHERE status = 'out_for_delivery';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET old_status = 'arrived'
      WHERE old_status = 'out_for_delivery';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET new_status = 'arrived'
      WHERE new_status = 'out_for_delivery';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE orders SET status = 'out_for_delivery' WHERE status = 'arrived';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET old_status = 'out_for_delivery'
      WHERE old_status = 'arrived';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET new_status = 'out_for_delivery'
      WHERE new_status = 'arrived';
    `);
  },
};
