import { literal, Op } from 'sequelize';
import Store from '@modules/store/store.model';
import { getGeofenceRadiusKm } from '@modules/platform-settings/platform-settings.service';

/**
 * Returns store IDs within a given radius (km) from a point.
 * When `radiusKm` is omitted, uses platform setting `geofence_radius_km` (env fallback).
 */
export async function getStoreIdsWithinRadius(
  lat: number,
  lng: number,
  radiusKm?: number,
): Promise<string[]> {
  const resolvedRadius = radiusKm ?? (await getGeofenceRadiusKm());

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);

  const latDelta = resolvedRadius / 111.0;

  const lngDelta =
    resolvedRadius / (111.0 * Math.max(Math.cos(latRad), 0.0001));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

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

  const stores = await Store.findAll({
    where: {
      isActive: true,
      isHoliday: false,
      latitude: { [Op.between]: [minLat, maxLat] },
      longitude: { [Op.between]: [minLng, maxLng] },
      [Op.and]: literal(`${haversine} <= :radiusKm`),
    },
    attributes: [
      'id',
      [literal(haversine), 'distance'],
    ],
    replacements: {
      cosLat,
      sinLat,
      lngRad,
      radiusKm: resolvedRadius,
    },
  });

  return stores.map((store) => store.id);
}
