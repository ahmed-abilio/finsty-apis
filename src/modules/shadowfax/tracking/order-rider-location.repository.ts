import { Op } from 'sequelize';
import OrderRiderLocation from './order-rider-location.model';

export async function insertRiderLocation(data: {
  orderId: string;
  latitude: number;
  longitude: number;
  pickupEta?: number | null;
  dropEta?: number | null;
  recordedAt?: Date;
}): Promise<OrderRiderLocation> {
  return OrderRiderLocation.create({
    orderId: data.orderId,
    latitude: data.latitude,
    longitude: data.longitude,
    pickupEta: data.pickupEta ?? null,
    dropEta: data.dropEta ?? null,
    recordedAt: data.recordedAt ?? new Date(),
  });
}

export async function deleteRiderLocationsOlderThan(cutoff: Date): Promise<number> {
  return OrderRiderLocation.destroy({
    where: { recordedAt: { [Op.lt]: cutoff } },
  });
}
