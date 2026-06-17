'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName ?? t));
    if (names.includes('order_rider_locations')) return;

    await queryInterface.createTable('order_rider_locations', {
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
      latitude: { type: Sequelize.DECIMAL(12, 8), allowNull: false },
      longitude: { type: Sequelize.DECIMAL(12, 8), allowNull: false },
      pickup_eta: { type: Sequelize.INTEGER, allowNull: true },
      drop_eta: { type: Sequelize.INTEGER, allowNull: true },
      recorded_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('order_rider_locations', ['order_id'], {
      name: 'order_rider_locations_order_id_idx',
    });
    await queryInterface.addIndex('order_rider_locations', ['recorded_at'], {
      name: 'order_rider_locations_recorded_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('order_rider_locations');
  },
};
