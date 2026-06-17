'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName ?? t));
    if (names.includes('shadowfax_shipments')) return;

    await queryInterface.createTable('shadowfax_shipments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('pending', 'placed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      shadowfax_order_id: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      track_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      delivery_cost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      client_code: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      request_payload: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      response_payload: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      placed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('shadowfax_shipments', ['order_id'], {
      unique: true,
      name: 'shadowfax_shipments_order_id_unique',
    });
    await queryInterface.addIndex('shadowfax_shipments', ['status'], {
      name: 'shadowfax_shipments_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shadowfax_shipments');
  },
};
