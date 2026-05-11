'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('addresses');

    if (!columns['latitude']) {
      await queryInterface.addColumn('addresses', 'latitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }
    if (!columns['longitude']) {
      await queryInterface.addColumn('addresses', 'longitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('addresses');

    if (columns['latitude']) {
      await queryInterface.removeColumn('addresses', 'latitude');
    }
    if (columns['longitude']) {
      await queryInterface.removeColumn('addresses', 'longitude');
    }
  },
};
