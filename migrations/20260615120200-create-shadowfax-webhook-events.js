'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName ?? t));
    if (names.includes('shadowfax_webhook_events')) return;

    await queryInterface.createTable('shadowfax_webhook_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      event_key: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      sfx_order_id: { type: Sequelize.BIGINT, allowNull: true },
      client_order_id: { type: Sequelize.STRING(255), allowNull: true },
      status: { type: Sequelize.STRING(100), allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: false },
      processed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      processed_at: { type: Sequelize.DATE, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('shadowfax_webhook_events', ['event_key'], {
      unique: true,
      name: 'shadowfax_webhook_events_event_key_unique',
    });
    await queryInterface.addIndex('shadowfax_webhook_events', ['client_order_id'], {
      name: 'shadowfax_webhook_events_client_order_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shadowfax_webhook_events');
  },
};
