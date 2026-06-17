'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const orders = await queryInterface.describeTable('orders');

    const addCol = async (name, spec) => {
      if (!orders[name]) await queryInterface.addColumn('orders', name, spec);
    };

    await addCol('shadowfax_order_id', { type: Sequelize.BIGINT, allowNull: true });
    await addCol('shadowfax_tracking_url', { type: Sequelize.TEXT, allowNull: true });
    await addCol('delivery_partner', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'SHADOWFAX',
    });
    await addCol('delivered_at', { type: Sequelize.DATE, allowNull: true });
    await addCol('cancelled_at', { type: Sequelize.DATE, allowNull: true });
    await addCol('returned_at', { type: Sequelize.DATE, allowNull: true });
    await addCol('rider_id', { type: Sequelize.BIGINT, allowNull: true });
    await addCol('rider_name', { type: Sequelize.STRING(255), allowNull: true });
    await addCol('rider_phone', { type: Sequelize.STRING(50), allowNull: true });
    await addCol('delivery_metadata', { type: Sequelize.JSONB, allowNull: true });

    // Convert status enum to VARCHAR (drop default first — it pins the enum type)
    await queryInterface.sequelize.query(`
      ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE orders
      ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
    `);

    await queryInterface.sequelize.query(`
      UPDATE orders SET status = 'at_store' WHERE status = 'processing';
      UPDATE orders SET status = 'out_for_delivery' WHERE status = 'shipped';
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_orders_status";
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';
    `);

    await queryInterface.sequelize.query(`
      UPDATE orders o
      SET shadowfax_order_id = CASE
            WHEN s.shadowfax_order_id ~ '^[0-9]+$' THEN s.shadowfax_order_id::bigint
            ELSE NULL
          END,
          shadowfax_tracking_url = s.track_url
      FROM shadowfax_shipments s
      WHERE s.order_id = o.id AND s.shadowfax_order_id IS NOT NULL;
    `);

    const indexes = await queryInterface.showIndex('orders');
    const indexNames = indexes.map((i) => i.name);
    if (!indexNames.includes('orders_shadowfax_order_id_idx')) {
      await queryInterface.addIndex('orders', ['shadowfax_order_id'], {
        name: 'orders_shadowfax_order_id_idx',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
    `);

    await queryInterface.sequelize.query(`
      UPDATE orders SET status = 'processing' WHERE status = 'at_store';
      UPDATE orders SET status = 'shipped' WHERE status = 'out_for_delivery';
      UPDATE orders SET status = 'confirmed' WHERE status IN (
        'rider_assigned', 'picked_up', 'returned'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_orders_status" AS ENUM (
        'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE orders
      ALTER COLUMN status TYPE "enum_orders_status" USING status::"enum_orders_status";
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';
    `);

    await queryInterface.removeIndex('orders', 'orders_shadowfax_order_id_idx').catch(() => {});

    const cols = [
      'shadowfax_order_id',
      'shadowfax_tracking_url',
      'delivery_partner',
      'delivered_at',
      'cancelled_at',
      'returned_at',
      'rider_id',
      'rider_name',
      'rider_phone',
      'delivery_metadata',
    ];
    for (const col of cols) {
      await queryInterface.removeColumn('orders', col).catch(() => {});
    }
  },
};
