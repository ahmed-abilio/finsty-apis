'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ['user_users', 'vendor_users', 'admin_users'];
    for (const tableName of tables) {
      const desc = await queryInterface.describeTable(tableName).catch(() => null);
      if (!desc) continue;
      if (desc.last_login_at) continue;
      await queryInterface.addColumn(tableName, 'last_login_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tables = ['user_users', 'vendor_users', 'admin_users'];
    for (const tableName of tables) {
      const desc = await queryInterface.describeTable(tableName).catch(() => null);
      if (!desc || !desc.last_login_at) continue;
      await queryInterface.removeColumn(tableName, 'last_login_at');
    }
  },
};
