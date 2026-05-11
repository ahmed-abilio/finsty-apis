'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('users');

    if (!columns['name']) {
      await queryInterface.addColumn('users', 'name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'firebase_uid',
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('users');

    if (columns['name']) {
      await queryInterface.removeColumn('users', 'name');
    }
  },
};
