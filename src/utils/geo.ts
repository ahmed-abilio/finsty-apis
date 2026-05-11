import { literal, Op } from 'sequelize';
import Store from '@modules/store/store.model';

// Default radius (can be overridden per call)
export const GEOFENCE_RADIUS_KM = parseFloat(
  process.env.GEOFENCE_RADIUS_KM ?? '10',
);

/**
 * Returns store IDs within a given radius (km) from a point
 */
export async function getStoreIdsWithinRadius(
  lat: number,
  lng: number,
  radiusKm: number = GEOFENCE_RADIUS_KM,
): Promise<string[]> {
  // ─────────────────────────────────────────────
  // 1. Precompute user trig values ( faster than doing it in SQL for each row)
  // ─────────────────────────────────────────────
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);

  // ─────────────────────────────────────────────
  // 2. Bounding box (cheap pre-filter)
  // ─────────────────────────────────────────────
  const latDelta = radiusKm / 111.0;

  // Prevent division issues near poles
  const lngDelta =
    radiusKm / (111.0 * Math.max(Math.cos(latRad), 0.0001));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  // ─────────────────────────────────────────────
  // 3. Haversine SQL (safe + reusable)
  // ─────────────────────────────────────────────
  const haversine = `
    (
      6371 * acos(
        LEAST(1,
          :cosLat *
          cos(radians("Store"."latitude")) *
          cos(radians("Store"."longitude") - :lngRad) +
          :sinLat *
          sin(radians("Store"."latitude"))
        )
      )
    )
  `;

  // ─────────────────────────────────────────────
  // 4. Query
  // ─────────────────────────────────────────────
  const stores = await Store.findAll({
    where: {
      isActive: true,

      // Bounding box filter (uses index)
      latitude: { [Op.between]: [minLat, maxLat] },
      longitude: { [Op.between]: [minLng, maxLng] },

      // Distance filter
      [Op.and]: literal(`${haversine} <= :radiusKm`),
    },

    attributes: [
      'id',
      [literal(haversine), 'distance'], // optional: remove if you don't need distance
    ],

    replacements: {
      cosLat,
      sinLat,
      lngRad,
      radiusKm,
    },
  });

  // ─────────────────────────────────────────────
  // 5. Return only IDs
  // ─────────────────────────────────────────────
  return stores.map((store) => store.id);
}