'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('price_banners')) {
      await queryInterface.createTable('price_banners', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        image_url: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        price_threshold: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: false,
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

      await queryInterface.addIndex('price_banners', ['is_active'], {
        name: 'price_banners_is_active_idx',
      });
    }

    if (!tables.includes('store_discount_banners')) {
      await queryInterface.createTable('store_discount_banners', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        store_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'stores', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        title: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        image_url: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        discount_percentage: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        is_approved: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: false,
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

      await queryInterface.addIndex('store_discount_banners', ['store_id'], {
        name: 'store_discount_banners_store_id_idx',
      });
      await queryInterface.addIndex('store_discount_banners', ['is_active'], {
        name: 'store_discount_banners_is_active_idx',
      });
      await queryInterface.addIndex('store_discount_banners', ['is_approved'], {
        name: 'store_discount_banners_is_approved_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('store_discount_banners').catch(() => undefined);
    await queryInterface.dropTable('price_banners').catch(() => undefined);
  },
};
