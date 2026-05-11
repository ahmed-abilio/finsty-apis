'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // USING cast is required when converting varchar → uuid in PostgreSQL
    await queryInterface.sequelize.query(
      `ALTER TABLE products ALTER COLUMN brand TYPE UUID USING brand::uuid;`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('products', 'brand', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },
};
