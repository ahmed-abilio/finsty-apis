'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('stores');

    if (!columns['gst_document']) {
      await queryInterface.addColumn('stores', 'gst_document', {
        type: Sequelize.STRING(2048),
        allowNull: true,
      });
    }

    if (columns['additional_documents'] && !columns['store_images']) {
      await queryInterface.renameColumn('stores', 'additional_documents', 'store_images');
    }
  },

  async down(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('stores');

    if (columns['store_images'] && !columns['additional_documents']) {
      await queryInterface.renameColumn('stores', 'store_images', 'additional_documents');
    }

    if (columns['gst_document']) {
      await queryInterface.removeColumn('stores', 'gst_document');
    }
  },
};
