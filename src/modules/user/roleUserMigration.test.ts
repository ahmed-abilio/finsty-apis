import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const migration = require('../../../migrations/20260520143000-create-role-user-tables.js');

const SequelizeMock = {
  UUID: 'UUID',
  STRING: (len: number) => `STRING(${len})`,
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  ENUM: (...args: string[]) => `ENUM(${args.join(',')})`,
  literal: (value: string) => value,
};

describe('role user table migration', () => {
  let queryInterface: any;

  beforeEach(() => {
    queryInterface = {
      showAllTables: vi.fn(),
      createTable: vi.fn(),
      addIndex: vi.fn().mockResolvedValue(undefined),
      dropTable: vi.fn().mockResolvedValue(undefined),
      sequelize: {
        query: vi.fn().mockImplementation(() =>
          Promise.resolve([[{
            legacy_user: 0,
            copied_user: 0,
            legacy_admin: 0,
            copied_admin: 0,
            legacy_vendor: 0,
            copied_vendor: 0,
          }]]),
        ),
      },
    };
  });

  it('creates role tables and migrates data from users', async () => {
    queryInterface.showAllTables.mockResolvedValue(['users']);

    await migration.up(queryInterface, SequelizeMock);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(3);
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "user_users"'),
    );
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "admin_users"'),
    );
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "vendor_users"'),
    );
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('legacy_user'),
    );
  });

  it('is idempotent when role tables already exist', async () => {
    queryInterface.showAllTables.mockResolvedValue(['users', 'user_users', 'admin_users', 'vendor_users']);

    await migration.up(queryInterface, SequelizeMock);

    expect(queryInterface.createTable).not.toHaveBeenCalled();
    expect(queryInterface.addIndex).toHaveBeenCalled();
  });

  it('copies back to users and drops role tables on down', async () => {
    queryInterface.showAllTables.mockResolvedValue(['users', 'user_users', 'admin_users', 'vendor_users']);

    await migration.down(queryInterface);

    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM "vendor_users"'),
    );
    expect(queryInterface.dropTable).toHaveBeenCalledWith('vendor_users');
    expect(queryInterface.dropTable).toHaveBeenCalledWith('admin_users');
    expect(queryInterface.dropTable).toHaveBeenCalledWith('user_users');
  });
});

