'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('user', 'vendor', 'admin'),
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM(
          'orders',
          'inventory',
          'payments',
          'wallet',
          'promotions',
          'account',
          'general',
        ),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('notifications', ['user_id', 'role', 'createdAt'], {
      name: 'notifications_user_role_created_idx',
    });

    await queryInterface.addIndex('notifications', ['user_id', 'role', 'category'], {
      name: 'notifications_user_role_category_idx',
    });

    await queryInterface.addIndex('notifications', ['user_id', 'role', 'is_read'], {
      name: 'notifications_user_role_read_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_category";');
  },
};
