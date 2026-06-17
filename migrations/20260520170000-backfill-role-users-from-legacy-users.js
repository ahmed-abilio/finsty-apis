'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tableNames = await queryInterface.showAllTables();
    const existingTables = new Set(
      tableNames.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name)),
    );

    if (!existingTables.has('users')) {
      return;
    }

    const providerEnumByTable = {
      user_users: 'enum_user_users_provider',
      admin_users: 'enum_admin_users_provider',
      vendor_users: 'enum_vendor_users_provider',
    };

    const copyByRole = async (targetTable, role) => {
      if (!existingTables.has(targetTable)) {
        throw new Error(`${targetTable} does not exist; run create-role-user-tables migration first`);
      }

      const providerEnum = providerEnumByTable[targetTable];
      await queryInterface.sequelize.query(`
        INSERT INTO "${targetTable}" (
          "id","firebase_uid","name","phone","email","profile_image","role","provider",
          "is_active","ip_address","referral_code","referred_by_id","createdAt","updatedAt"
        )
        SELECT
          u."id", u."firebase_uid", u."name", u."phone", u."email", u."profile_image", '${role}',
          (u."provider"::text)::"${providerEnum}",
          u."is_active", u."ip_address", u."referral_code", u."referred_by_id", u."createdAt", u."updatedAt"
        FROM "users" u
        WHERE u."role" = '${role}'
        ON CONFLICT ("id") DO UPDATE SET
          "firebase_uid" = EXCLUDED."firebase_uid",
          "name" = EXCLUDED."name",
          "phone" = EXCLUDED."phone",
          "email" = EXCLUDED."email",
          "profile_image" = EXCLUDED."profile_image",
          "provider" = EXCLUDED."provider",
          "is_active" = EXCLUDED."is_active",
          "ip_address" = EXCLUDED."ip_address",
          "referral_code" = EXCLUDED."referral_code",
          "referred_by_id" = EXCLUDED."referred_by_id",
          "updatedAt" = EXCLUDED."updatedAt";
      `);
    };

    await copyByRole('user_users', 'user');
    await copyByRole('admin_users', 'admin');
    await copyByRole('vendor_users', 'vendor');

    const [[counts]] = await queryInterface.sequelize.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "users" WHERE "role" = 'user') AS legacy_user,
        (SELECT COUNT(*)::int FROM "user_users") AS copied_user,
        (SELECT COUNT(*)::int FROM "users" WHERE "role" = 'admin') AS legacy_admin,
        (SELECT COUNT(*)::int FROM "admin_users") AS copied_admin,
        (SELECT COUNT(*)::int FROM "users" WHERE "role" = 'vendor') AS legacy_vendor,
        (SELECT COUNT(*)::int FROM "vendor_users") AS copied_vendor;
    `);

    if (counts.legacy_user !== counts.copied_user) {
      throw new Error(`user role copy mismatch: users=${counts.legacy_user}, user_users=${counts.copied_user}`);
    }
    if (counts.legacy_admin !== counts.copied_admin) {
      throw new Error(`admin role copy mismatch: users=${counts.legacy_admin}, admin_users=${counts.copied_admin}`);
    }
    if (counts.legacy_vendor !== counts.copied_vendor) {
      throw new Error(`vendor role copy mismatch: users=${counts.legacy_vendor}, vendor_users=${counts.copied_vendor}`);
    }
  },

  async down() {
    // Data backfill only; no destructive rollback.
  },
};
