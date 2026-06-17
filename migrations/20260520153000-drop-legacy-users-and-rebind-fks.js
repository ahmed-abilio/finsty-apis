'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tableNames = await queryInterface.showAllTables();
    const existingTables = new Set(
      tableNames.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name)),
    );

    if (!existingTables.has('user_users')) {
      throw new Error('user_users table not found; run create-role-user-tables migration first');
    }

    if (!existingTables.has('users')) {
      return;
    }

    const [fkRows] = await queryInterface.sequelize.query(`
      SELECT
        con.conname AS constraint_name,
        nsp.nspname AS schema_name,
        rel.relname AS table_name,
        pg_get_constraintdef(con.oid) AS constraint_def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_class ref ON ref.oid = con.confrelid
      JOIN pg_namespace ref_nsp ON ref_nsp.oid = ref.relnamespace
      WHERE con.contype = 'f'
        AND ref.relname = 'users'
        AND ref_nsp.nspname = 'public';
    `);

    for (const row of fkRows) {
      if (row.table_name === 'users') {
        continue;
      }

      if (/REFERENCES\s+"user_users"/i.test(row.constraint_def)) {
        continue;
      }

      const tableRef = `"${row.schema_name}"."${row.table_name}"`;
      const columnMatch = row.constraint_def.match(/FOREIGN KEY \(([^)]+)\)/i);
      const fkColumn = (columnMatch?.[1] ?? 'user_id').replace(/"/g, '');

      const [[orphanCheck]] = await queryInterface.sequelize.query(`
        SELECT COUNT(*)::int AS orphan_count
        FROM ${tableRef} child
        LEFT JOIN "user_users" uu ON child."${fkColumn}" = uu.id
        WHERE child."${fkColumn}" IS NOT NULL AND uu.id IS NULL;
      `);

      if (orphanCheck?.orphan_count > 0) {
        await queryInterface.sequelize.query(`
          DELETE FROM ${tableRef}
          WHERE "${fkColumn}" IS NOT NULL
            AND "${fkColumn}" NOT IN (SELECT id FROM "user_users");
        `);
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE ${tableRef} DROP CONSTRAINT IF EXISTS "${row.constraint_name}";`,
      );

      const newDef = row.constraint_def.replace(/REFERENCES\s+"?users"?/gi, 'REFERENCES "user_users"');
      await queryInterface.sequelize.query(
        `ALTER TABLE ${tableRef} ADD CONSTRAINT "${row.constraint_name}" ${newDef};`,
      );
    }

    await queryInterface.dropTable('users');
  },

  async down(queryInterface, Sequelize) {
    const tableNames = await queryInterface.showAllTables();
    const existingTables = new Set(
      tableNames.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name)),
    );

    if (!existingTables.has('users')) {
      await queryInterface.createTable('users', {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        firebase_uid: { type: Sequelize.STRING(128), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(255), allowNull: true },
        phone: { type: Sequelize.STRING(20), allowNull: true },
        email: { type: Sequelize.STRING(255), allowNull: true },
        profile_image: { type: Sequelize.STRING(2048), allowNull: true },
        role: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'user' },
        provider: { type: Sequelize.ENUM('phone', 'google', 'apple'), allowNull: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        ip_address: { type: Sequelize.STRING(45), allowNull: true },
        referral_code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        referred_by_id: { type: Sequelize.UUID, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      });
    }

    if (existingTables.has('user_users')) {
      await queryInterface.sequelize.query(`
        INSERT INTO "users" (
          "id","firebase_uid","name","phone","email","profile_image","role","provider",
          "is_active","ip_address","referral_code","referred_by_id","createdAt","updatedAt"
        )
        SELECT
          u."id", u."firebase_uid", u."name", u."phone", u."email", u."profile_image", u."role", u."provider",
          u."is_active", u."ip_address", u."referral_code", u."referred_by_id", u."createdAt", u."updatedAt"
        FROM "user_users" u
        ON CONFLICT ("id") DO UPDATE SET
          "firebase_uid" = EXCLUDED."firebase_uid",
          "name" = EXCLUDED."name",
          "phone" = EXCLUDED."phone",
          "email" = EXCLUDED."email",
          "profile_image" = EXCLUDED."profile_image",
          "role" = EXCLUDED."role",
          "provider" = EXCLUDED."provider",
          "is_active" = EXCLUDED."is_active",
          "ip_address" = EXCLUDED."ip_address",
          "referral_code" = EXCLUDED."referral_code",
          "referred_by_id" = EXCLUDED."referred_by_id",
          "updatedAt" = EXCLUDED."updatedAt";
      `);
    }
  },
};
