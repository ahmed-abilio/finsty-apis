'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Use IF NOT EXISTS to avoid describeTable round-trip and make re-runs safe.
    await queryInterface.sequelize.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS is_dispatch_ready BOOLEAN NOT NULL DEFAULT false;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE orders DROP COLUMN IF EXISTS is_dispatch_ready;
    `);
  },
};
