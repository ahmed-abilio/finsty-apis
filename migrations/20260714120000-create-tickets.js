'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // Create the ENUM types first
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tickets_status') THEN
          CREATE TYPE "enum_tickets_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED');
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tickets_type') THEN
          CREATE TYPE "enum_tickets_type" AS ENUM ('USER_TO_STORE', 'VENDOR_TO_ADMIN');
        END IF;
      END $$;
    `);

    if (!tables.includes('tickets')) {
      await queryInterface.createTable('tickets', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        raised_by_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        store_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'stores', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        image_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        status: {
          type: Sequelize.ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        type: {
          type: Sequelize.ENUM('USER_TO_STORE', 'VENDOR_TO_ADMIN'),
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

      await queryInterface.addIndex('tickets', ['raised_by_id'], {
        name: 'tickets_raised_by_id_idx',
      });
      await queryInterface.addIndex('tickets', ['store_id'], {
        name: 'tickets_store_id_idx',
      });
      await queryInterface.addIndex('tickets', ['type'], {
        name: 'tickets_type_idx',
      });
      await queryInterface.addIndex('tickets', ['status'], {
        name: 'tickets_status_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tickets').catch(() => undefined);
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tickets_status";').catch(() => undefined);
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tickets_type";').catch(() => undefined);
  },
};
