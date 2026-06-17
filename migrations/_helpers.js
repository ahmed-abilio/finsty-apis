'use strict';

function normalizeTableNames(tables) {
  return new Set(
    tables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name)),
  );
}

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return normalizeTableNames(tables).has(tableName);
}

module.exports = {
  normalizeTableNames,
  tableExists,
};
