'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName ?? t));
    if (names.includes('platform_settings')) return;

    await queryInterface.createTable('platform_settings', {
      key: {
        type: Sequelize.STRING(128),
        primaryKey: true,
        allowNull: false,
      },
      value: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    const port = process.env.PORT ?? '3001';
    await queryInterface.bulkInsert('platform_settings', [
      {
        key: 'shadowfax_dev_local_callback_enabled',
        value: JSON.stringify(false),
        description:
          'Development only: poll Shadowfax status API and apply updates locally (simulates webhooks on localhost). Ignored when NODE_ENV is not development.',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        key: 'shadowfax_dev_local_callback_base_url',
        value: JSON.stringify(`http://localhost:${port}`),
        description:
          'Local base URL for manual webhook testing (POST {base}/api/webhooks/shadowfax). Used when shadowfax_dev_local_callback_enabled is true.',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('platform_settings');
  },
};
