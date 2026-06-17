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

async function columnExists(queryInterface, tableName, columnName) {
  if (!(await tableExists(queryInterface, tableName))) {
    return false;
  }
  const columns = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(columns, columnName);
}

module.exports = {
  normalizeTableNames,
  tableExists,
  columnExists,
};
