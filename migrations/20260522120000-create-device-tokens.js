'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('device_tokens', {
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
      platform: {
        type: Sequelize.ENUM('ios', 'android'),
        allowNull: false,
      },
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
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

    await queryInterface.addIndex('device_tokens', ['user_id', 'role'], {
      name: 'device_tokens_user_id_role_idx',
    });

    await queryInterface.addIndex('device_tokens', ['user_id', 'role', 'token'], {
      unique: true,
      name: 'device_tokens_user_role_token_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('device_tokens');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_device_tokens_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_device_tokens_platform";');
  },
};
