'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('tickets').catch(() => null);
    if (!table || !table.image_url) return;

    // Skip if already jsonb (e.g. fresh DB from updated create-tickets migration).
    if (table.image_url.type && String(table.image_url.type).toLowerCase().includes('json')) {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE tickets
      ALTER COLUMN image_url TYPE jsonb
      USING CASE
        WHEN image_url IS NULL OR btrim(image_url) = '' THEN NULL
        ELSE to_jsonb(ARRAY[image_url])
      END
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('tickets').catch(() => null);
    if (!table || !table.image_url) return;

    await queryInterface.sequelize.query(`
      ALTER TABLE tickets
      ALTER COLUMN image_url TYPE varchar(500)
      USING CASE
        WHEN image_url IS NULL THEN NULL
        WHEN jsonb_typeof(image_url) = 'array' THEN NULLIF(image_url->>0, '')
        ELSE NULLIF(image_url::text, '')
      END
    `);
  },
};
