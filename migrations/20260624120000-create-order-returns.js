'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = new Set(tables.map((t) => (typeof t === 'string' ? t : t.tableName ?? t)));

    if (!names.has('order_returns')) {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_order_returns_status" CASCADE;',
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_order_returns_logistics_status" CASCADE;',
      );
    }

    if (!names.has('shadowfax_return_shipments')) {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_shadowfax_return_shipments_status" CASCADE;',
      );
    }

    if (!names.has('order_returns')) {
      await queryInterface.createTable('order_returns', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        order_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        store_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        status: {
          type: Sequelize.ENUM(
            'requested',
            'pickup_scheduled',
            'rider_assigned',
            'at_store',
            'picked_up',
            'arrived',
            'received_at_store',
            'pending_inspection',
            'refund_approved',
            'refund_rejected',
            'cancelled',
          ),
          allowNull: false,
          defaultValue: 'requested',
        },
        logistics_status: {
          type: Sequelize.ENUM(
            'requested',
            'pickup_scheduled',
            'rider_assigned',
            'at_store',
            'picked_up',
            'arrived',
            'delivered',
          ),
          allowNull: true,
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        rejection_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        refund_amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
        },
        shadowfax_order_id: {
          type: Sequelize.STRING(128),
          allowNull: true,
        },
        shadowfax_tracking_url: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        delivery_metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        rider_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        rider_name: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        rider_phone: {
          type: Sequelize.STRING(32),
          allowNull: true,
        },
        requested_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        received_at_store_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        inspected_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        refund_processed_at: {
          type: Sequelize.DATE,
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

      await queryInterface.addIndex('order_returns', ['order_id'], {
        name: 'order_returns_order_id_idx',
      });
      await queryInterface.addIndex('order_returns', ['store_id', 'status'], {
        name: 'order_returns_store_status_idx',
      });
      await queryInterface.addIndex('order_returns', ['user_id'], {
        name: 'order_returns_user_id_idx',
      });
    }

    if (!names.has('order_return_items')) {
      await queryInterface.createTable('order_return_items', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        order_return_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        order_item_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        quantity: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        unit_price: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        refund_amount: {
          type: Sequelize.DECIMAL(12, 2),
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

      await queryInterface.addIndex('order_return_items', ['order_return_id'], {
        name: 'order_return_items_return_id_idx',
      });
      await queryInterface.addIndex('order_return_items', ['order_item_id'], {
        name: 'order_return_items_order_item_id_idx',
      });
    }

    if (!names.has('shadowfax_return_shipments')) {
      await queryInterface.createTable('shadowfax_return_shipments', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        order_return_id: {
          type: Sequelize.UUID,
          allowNull: false,
          unique: true,
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

      await queryInterface.addIndex('shadowfax_return_shipments', ['order_return_id'], {
        unique: true,
        name: 'shadowfax_return_shipments_return_id_unique',
      });
      await queryInterface.addIndex('shadowfax_return_shipments', ['shadowfax_order_id'], {
        name: 'shadowfax_return_shipments_sfx_order_id_idx',
      });
      await queryInterface.addIndex('shadowfax_return_shipments', ['status'], {
        name: 'shadowfax_return_shipments_status_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shadowfax_return_shipments');
    await queryInterface.dropTable('order_return_items');
    await queryInterface.dropTable('order_returns');
  },
};
