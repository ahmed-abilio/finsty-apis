'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;

    await q.query(`ALTER TABLE coupon_usages DROP CONSTRAINT IF EXISTS "coupon_usages_order_id_key";`);
    await q.query(`DROP INDEX IF EXISTS "coupon_usages_order_id_unique";`);
    await q.query(`DROP INDEX IF EXISTS "coupon_usages_order_id";`);

    const [idx] = await q.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'coupon_usages'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%(order_id)%'
        AND indexdef NOT LIKE '%coupon_id%';
    `);
    for (const row of idx) {
      const name = row.indexname;
      if (name && name !== 'coupon_usages_pkey') {
        await q.query(`DROP INDEX IF EXISTS "public"."${String(name).replace(/"/g, '')}";`);
      }
    }

    const [existingIdx] = await q.query(`
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'coupon_usages'
        AND indexname = 'coupon_usages_order_id_coupon_id_unique';
    `);

    if (existingIdx.length === 0) {
      await queryInterface.addIndex('coupon_usages', ['order_id', 'coupon_id'], {
        unique: true,
        name: 'coupon_usages_order_id_coupon_id_unique',
      });
    }

    const ordersCols = await queryInterface.describeTable('orders');
    if (ordersCols.coupon_code) {
      await queryInterface.changeColumn('orders', 'coupon_code', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('coupon_usages', 'coupon_usages_order_id_coupon_id_unique').catch(() => {});

    await queryInterface.addIndex('coupon_usages', ['order_id'], {
      unique: true,
      name: 'coupon_usages_order_id_unique',
    });

    const ordersCols = await queryInterface.describeTable('orders');
    if (ordersCols.coupon_code) {
      await queryInterface.changeColumn('orders', 'coupon_code', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }
  },
};
