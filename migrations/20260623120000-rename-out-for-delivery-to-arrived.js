'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE orders SET status = 'arrived' WHERE status = 'out_for_delivery';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET from_status = 'arrived'
      WHERE from_status = 'out_for_delivery';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET to_status = 'arrived'
      WHERE to_status = 'out_for_delivery';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE orders SET status = 'out_for_delivery' WHERE status = 'arrived';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET from_status = 'out_for_delivery'
      WHERE from_status = 'arrived';
    `);
    await queryInterface.sequelize.query(`
      UPDATE order_status_history
      SET to_status = 'out_for_delivery'
      WHERE to_status = 'arrived';
    `);
  },
};
