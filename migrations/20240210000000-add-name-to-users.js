'use strict';

const { tableExists } = require('../scripts/migration-helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'users'))) {
      return;
    }

    const columns = await queryInterface.describeTable('users');

    if (!columns['name']) {
      await queryInterface.addColumn('users', 'name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'users'))) {
      return;
    }

    const columns = await queryInterface.describeTable('users');

    if (columns['name']) {
      await queryInterface.removeColumn('users', 'name');
    }
  },
};
