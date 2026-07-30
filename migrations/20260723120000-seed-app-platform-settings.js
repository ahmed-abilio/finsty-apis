'use strict';

/**
 * Seed app-facing platform settings (GST, platform fee, geofence, referral, YouTube).
 * Values prefer env at migrate time; rows are inserted only when the key is missing.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName ?? t));
    if (!names.includes('platform_settings')) {
      throw new Error(
        'platform_settings table missing — run 20260615120400-create-platform-settings first',
      );
    }

    const [existing] = await queryInterface.sequelize.query(
      `SELECT key FROM platform_settings WHERE key IN (
        'tax_rate',
        'platform_fee',
        'geofence_radius_km',
        'referral_reward_amount',
        'youtube_url'
      )`,
    );
    const have = new Set((existing || []).map((r) => r.key));

    const parseNum = (raw, fallback) => {
      const n = parseFloat(String(raw ?? '').trim());
      return Number.isFinite(n) ? n : fallback;
    };

    const now = new Date();
    const rows = [
      {
        key: 'tax_rate',
        value: JSON.stringify(parseNum(process.env.TAX_RATE, 0.18)),
        description:
          'GST / tax rate on merchandise subtotal (e.g. 0.18 = 18%). Used in cart and checkout.',
      },
      {
        key: 'platform_fee',
        value: JSON.stringify(parseNum(process.env.PLATFORM_FEE, 0)),
        description: 'Fixed platform fee per order in INR (not a percentage).',
      },
      {
        key: 'geofence_radius_km',
        value: JSON.stringify(parseNum(process.env.GEOFENCE_RADIUS_KM, 10)),
        description: 'Default store search / geofence radius in kilometres.',
      },
      {
        key: 'referral_reward_amount',
        value: JSON.stringify(parseNum(process.env.REFERRAL_REWARD_AMOUNT, 100)),
        description: 'Wallet credit (INR) for referrer and referred user on first delivered order.',
      },
      {
        key: 'youtube_url',
        value: JSON.stringify((process.env.YOUTUBE_URL ?? '').trim()),
        description: 'Public YouTube / help video URL shown in apps.',
      },
    ]
      .filter((r) => !have.has(r.key))
      .map((r) => ({ ...r, created_at: now, updated_at: now }));

    if (rows.length > 0) {
      await queryInterface.bulkInsert('platform_settings', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('platform_settings', {
      key: [
        'tax_rate',
        'platform_fee',
        'geofence_radius_km',
        'referral_reward_amount',
        'youtube_url',
      ],
    });
  },
};
