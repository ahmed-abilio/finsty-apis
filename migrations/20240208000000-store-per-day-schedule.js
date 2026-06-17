'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = new Set(
      tables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name)),
    );
    if (!tableNames.has('stores')) {
      return;
    }

    const columns = await queryInterface.describeTable('stores');

    if (columns['opening_time']) {
      await queryInterface.removeColumn('stores', 'opening_time');
    }
    if (columns['closing_time']) {
      await queryInterface.removeColumn('stores', 'closing_time');
    }

    if (columns['working_days']) {
      await queryInterface.removeColumn('stores', 'working_days');
    }
    await queryInterface.addColumn('stores', 'working_days', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [
        { day: 'Mon', openingTime: null, closingTime: null },
        { day: 'Tue', openingTime: null, closingTime: null },
        { day: 'Wed', openingTime: null, closingTime: null },
        { day: 'Thu', openingTime: null, closingTime: null },
        { day: 'Fri', openingTime: null, closingTime: null },
        { day: 'Sat', openingTime: null, closingTime: null },
        { day: 'Sun', openingTime: null, closingTime: null },
      ],
    });

    if (!columns['is_holiday']) {
      await queryInterface.addColumn('stores', 'is_holiday', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('stores');

    if (columns['is_holiday']) {
      await queryInterface.removeColumn('stores', 'is_holiday');
    }

    if (columns['working_days']) {
      await queryInterface.removeColumn('stores', 'working_days');
    }
    await queryInterface.addColumn('stores', 'working_days', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: false,
      defaultValue: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    });

    if (!columns['opening_time']) {
      await queryInterface.addColumn('stores', 'opening_time', {
        type: Sequelize.STRING(5),
        allowNull: true,
      });
    }
    if (!columns['closing_time']) {
      await queryInterface.addColumn('stores', 'closing_time', {
        type: Sequelize.STRING(5),
        allowNull: true,
      });
    }
  },
};
