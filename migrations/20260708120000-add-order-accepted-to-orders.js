'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_accepted BOOLEAN NOT NULL DEFAULT false;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE orders DROP COLUMN IF EXISTS order_accepted;
    `);
  },
};
