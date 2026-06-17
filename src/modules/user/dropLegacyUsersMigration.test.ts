import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const migration = require('../../../migrations/20260520153000-drop-legacy-users-and-rebind-fks.js');

const SequelizeMock = {
  UUID: 'UUID',
  STRING: (len: number) => `STRING(${len})`,
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  ENUM: (...args: string[]) => `ENUM(${args.join(',')})`,
  literal: (value: string) => value,
};

describe('drop legacy users migration', () => {
  let queryInterface: any;

  beforeEach(() => {
    queryInterface = {
      showAllTables: vi.fn(),
      dropTable: vi.fn().mockResolvedValue(undefined),
      createTable: vi.fn().mockResolvedValue(undefined),
      sequelize: {
        query: vi.fn().mockResolvedValue([[]]),
      },
    };
  });

  it('deletes orphan rows and rebinds constraints without truncating', async () => {
    queryInterface.showAllTables.mockResolvedValue(['users', 'user_users', 'addresses']);
    queryInterface.sequelize.query
      .mockResolvedValueOnce([[
        {
          constraint_name: 'addresses_user_id_fkey',
          schema_name: 'public',
          table_name: 'addresses',
          constraint_def: 'FOREIGN KEY (user_id) REFERENCES "users"(id) ON UPDATE CASCADE ON DELETE CASCADE',
        },
      ]])
      .mockResolvedValueOnce([[{ orphan_count: 1 }]])
      .mockResolvedValue([[]]);

    await migration.up(queryInterface);

    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "public"."addresses"'),
    );
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP CONSTRAINT IF EXISTS "addresses_user_id_fkey"'),
    );
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('REFERENCES "user_users"'),
    );
    expect(queryInterface.dropTable).toHaveBeenCalledWith('users');
  });

  it('skips users self-referential constraints', async () => {
    queryInterface.showAllTables.mockResolvedValue(['users', 'user_users']);
    queryInterface.sequelize.query.mockResolvedValueOnce([[
      {
        constraint_name: 'users_referred_by_id_fkey',
        schema_name: 'public',
        table_name: 'users',
        constraint_def: 'FOREIGN KEY (referred_by_id) REFERENCES "users"(id)',
      },
    ]]);

    await migration.up(queryInterface);

    expect(queryInterface.sequelize.query).not.toHaveBeenCalledWith(
      expect.stringContaining('DROP CONSTRAINT IF EXISTS "users_referred_by_id_fkey"'),
    );
    expect(queryInterface.dropTable).toHaveBeenCalledWith('users');
  });

  it('creates users table in down when missing', async () => {
    queryInterface.showAllTables.mockResolvedValue(['user_users']);

    await migration.down(queryInterface, SequelizeMock);

    expect(queryInterface.createTable).toHaveBeenCalledWith('users', expect.any(Object));
  });
});
