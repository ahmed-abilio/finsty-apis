import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const migration = require('../../../migrations/20260520151000-collapse-user-users-into-users.js');

describe('collapse user_users migration', () => {
  it('is a no-op on up and down', async () => {
    const queryInterface = {
      showAllTables: () => Promise.resolve(['users', 'user_users']),
      sequelize: { query: () => Promise.reject(new Error('should not query')) },
      dropTable: () => Promise.reject(new Error('should not drop')),
      createTable: () => Promise.reject(new Error('should not create')),
    };

    await expect(migration.up(queryInterface)).resolves.toBeUndefined();
    await expect(migration.down(queryInterface)).resolves.toBeUndefined();
  });
});
