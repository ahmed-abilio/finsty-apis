'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('cart_items');

    if (!columns['is_selected']) {
      await queryInterface.addColumn('cart_items', 'is_selected', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('cart_items');

    if (columns['is_selected']) {
      await queryInterface.removeColumn('cart_items', 'is_selected');
    }
  },
};
