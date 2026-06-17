'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName ?? t));
    if (names.includes('order_status_history')) return;

    await queryInterface.createTable('order_status_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      old_status: { type: Sequelize.STRING(50), allowNull: false },
      new_status: { type: Sequelize.STRING(50), allowNull: false },
      source: { type: Sequelize.STRING(50), allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('order_status_history', ['order_id'], {
      name: 'order_status_history_order_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('order_status_history');
  },
};
