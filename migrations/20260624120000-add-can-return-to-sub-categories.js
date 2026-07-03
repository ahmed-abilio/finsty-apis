'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('sub_categories');

    if (!columns['can_return']) {
      await queryInterface.addColumn('sub_categories', 'can_return', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('sub_categories');

    if (columns['can_return']) {
      await queryInterface.removeColumn('sub_categories', 'can_return');
    }
  },
};
