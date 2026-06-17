'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cms_pages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      audience_type: {
        type: Sequelize.ENUM('user', 'vendor', 'admin', 'all'),
        allowNull: false,
      },
      content_html: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      is_published: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('cms_pages', ['slug', 'audience_type'], {
      unique: true,
      name: 'cms_pages_slug_audience_type_unique',
    });

    await queryInterface.addIndex('cms_pages', ['audience_type'], {
      name: 'cms_pages_audience_type_idx',
    });

    await queryInterface.addIndex('cms_pages', ['slug'], {
      name: 'cms_pages_slug_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cms_pages');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cms_pages_audience_type";');
  },
};
