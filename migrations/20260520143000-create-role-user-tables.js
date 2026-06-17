'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableNames = await queryInterface.showAllTables();
    const existingTables = new Set(
      tableNames.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name)),
    );

    const createRoleTable = async (tableName, role) => {
      if (!existingTables.has(tableName)) {
        await queryInterface.createTable(tableName, {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          firebase_uid: {
            type: Sequelize.STRING(128),
            allowNull: false,
            unique: true,
          },
          name: {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          phone: {
            type: Sequelize.STRING(20),
            allowNull: true,
          },
          email: {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          profile_image: {
            type: Sequelize.STRING(2048),
            allowNull: true,
          },
          role: {
            type: Sequelize.STRING(16),
            allowNull: false,
            defaultValue: role,
          },
          provider: {
            type: Sequelize.ENUM('phone', 'google', 'apple'),
            allowNull: false,
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          ip_address: {
            type: Sequelize.STRING(45),
            allowNull: true,
          },
          referral_code: {
            type: Sequelize.STRING(20),
            allowNull: false,
            unique: true,
          },
          referred_by_id: {
            type: Sequelize.UUID,
            allowNull: true,
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
          },
        });
      }

      await queryInterface.addIndex(tableName, ['firebase_uid'], {
        name: `${tableName}_firebase_uid_unique`,
        unique: true,
      }).catch(() => undefined);
      await queryInterface.addIndex(tableName, ['email'], {
        name: `${tableName}_email_idx`,
      }).catch(() => undefined);
      await queryInterface.addIndex(tableName, ['phone'], {
        name: `${tableName}_phone_idx`,
      }).catch(() => undefined);
      await queryInterface.addIndex(tableName, ['referral_code'], {
        name: `${tableName}_referral_code_unique`,
        unique: true,
      }).catch(() => undefined);
      await queryInterface.addIndex(tableName, ['referred_by_id'], {
        name: `${tableName}_referred_by_id_idx`,
      }).catch(() => undefined);
    };

    await createRoleTable('user_users', 'user');
    await createRoleTable('admin_users', 'admin');
    await createRoleTable('vendor_users', 'vendor');

    const providerEnumByTable = {
      user_users: 'enum_user_users_provider',
      admin_users: 'enum_admin_users_provider',
      vendor_users: 'enum_vendor_users_provider',
    };

    const copyByRole = async (targetTable, role) => {
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

    if (existingTables.has('users')) {
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
    }
  },

  async down(queryInterface) {
    const tableNames = await queryInterface.showAllTables();
    const existingTables = new Set(
      tableNames.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name)),
    );

    const reverseCopy = async (sourceTable) => {
      if (!existingTables.has(sourceTable)) return;
      await queryInterface.sequelize.query(`
        INSERT INTO "users" (
          "id","firebase_uid","name","phone","email","profile_image","role","provider",
          "is_active","ip_address","referral_code","referred_by_id","createdAt","updatedAt"
        )
        SELECT
          s."id", s."firebase_uid", s."name", s."phone", s."email", s."profile_image", s."role", s."provider",
          s."is_active", s."ip_address", s."referral_code", s."referred_by_id", s."createdAt", s."updatedAt"
        FROM "${sourceTable}" s
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
    };

    await reverseCopy('vendor_users');
    await reverseCopy('admin_users');
    await reverseCopy('user_users');

    await queryInterface.dropTable('vendor_users').catch(() => undefined);
    await queryInterface.dropTable('admin_users').catch(() => undefined);
    await queryInterface.dropTable('user_users').catch(() => undefined);
  },
};

