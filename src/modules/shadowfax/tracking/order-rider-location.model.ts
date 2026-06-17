import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface OrderRiderLocationAttributes {
  id: string;
  orderId: string;
  latitude: number;
  longitude: number;
  pickupEta: number | null;
  dropEta: number | null;
  recordedAt: Date;
  createdAt?: Date;
}

export interface OrderRiderLocationCreationAttributes
  extends Optional<OrderRiderLocationAttributes, 'id' | 'pickupEta' | 'dropEta' | 'recordedAt'> {}

class OrderRiderLocation
  extends Model<OrderRiderLocationAttributes, OrderRiderLocationCreationAttributes>
  implements OrderRiderLocationAttributes
{
  declare id: string;
  declare orderId: string;
  declare latitude: number;
  declare longitude: number;
  declare pickupEta: number | null;
  declare dropEta: number | null;
  declare recordedAt: Date;
  declare readonly createdAt: Date;
}

OrderRiderLocation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id',
    },
    latitude: {
      type: DataTypes.DECIMAL(12, 8),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(12, 8),
      allowNull: false,
    },
    pickupEta: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'pickup_eta',
    },
    dropEta: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'drop_eta',
    },
    recordedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'recorded_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'order_rider_locations',
    underscored: true,
    updatedAt: false,
    indexes: [{ fields: ['order_id'] }, { fields: ['recorded_at'] }],
  },
);

export default OrderRiderLocation;
