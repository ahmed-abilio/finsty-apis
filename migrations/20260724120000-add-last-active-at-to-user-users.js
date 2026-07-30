'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('user_users').catch(() => null);
    if (!desc || desc.last_active_at) return;

    await queryInterface.addColumn('user_users', 'last_active_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('user_users').catch(() => null);
    if (!desc || !desc.last_active_at) return;
    await queryInterface.removeColumn('user_users', 'last_active_at');
  },
};
