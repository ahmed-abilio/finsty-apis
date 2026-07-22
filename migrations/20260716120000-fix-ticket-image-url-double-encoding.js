'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('tickets').catch(() => null);
    if (!table || !table.image_url) return;

    // Ensure column is jsonb (in case prior migration was skipped incorrectly).
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tickets'
            AND column_name = 'image_url'
            AND data_type <> 'jsonb'
        ) THEN
          ALTER TABLE tickets
          ALTER COLUMN image_url TYPE jsonb
          USING CASE
            WHEN image_url IS NULL OR btrim(image_url::text) = '' THEN NULL
            WHEN left(btrim(image_url::text), 1) = '[' THEN btrim(image_url::text)::jsonb
            ELSE to_jsonb(ARRAY[btrim(image_url::text)])
          END;
        END IF;
      END $$;
    `);

    // Unwrap double-encoded values:
    // 1) jsonb string containing a JSON array: "\"[\\\"https://...\\\"]\""
    // 2) jsonb array with one string element that is itself a JSON array
    await queryInterface.sequelize.query(`
      UPDATE tickets
      SET image_url = CASE
        WHEN image_url IS NULL THEN NULL
        WHEN jsonb_typeof(image_url) = 'string'
          AND left(btrim(image_url #>> '{}'), 1) = '['
          THEN (image_url #>> '{}')::jsonb
        WHEN jsonb_typeof(image_url) = 'array'
          AND jsonb_array_length(image_url) = 1
          AND jsonb_typeof(image_url -> 0) = 'string'
          AND left(btrim(image_url ->> 0), 1) = '['
          THEN (image_url ->> 0)::jsonb
        ELSE image_url
      END
      WHERE image_url IS NOT NULL
        AND (
          (
            jsonb_typeof(image_url) = 'string'
            AND left(btrim(image_url #>> '{}'), 1) = '['
          )
          OR (
            jsonb_typeof(image_url) = 'array'
            AND jsonb_array_length(image_url) = 1
            AND jsonb_typeof(image_url -> 0) = 'string'
            AND left(btrim(image_url ->> 0), 1) = '['
          )
        )
    `);
  },

  async down() {
    // Irreversible data repair — no-op.
  },
};
