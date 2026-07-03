import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type ShadowfaxReturnShipmentStatus = 'pending' | 'placed' | 'failed';

export interface ShadowfaxReturnShipmentAttributes {
  id: string;
  orderReturnId: string;
  status: ShadowfaxReturnShipmentStatus;
  shadowfaxOrderId: string | null;
  trackUrl: string | null;
  deliveryCost: number | null;
  clientCode: string;
  requestPayload: object | null;
  responsePayload: object | null;
  errorMessage: string | null;
  placedAt: Date | null;
  attemptCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShadowfaxReturnShipmentCreationAttributes
  extends Optional<
    ShadowfaxReturnShipmentAttributes,
    | 'id'
    | 'shadowfaxOrderId'
    | 'trackUrl'
    | 'deliveryCost'
    | 'requestPayload'
    | 'responsePayload'
    | 'errorMessage'
    | 'placedAt'
    | 'attemptCount'
  > {}

class ShadowfaxReturnShipment
  extends Model<ShadowfaxReturnShipmentAttributes, ShadowfaxReturnShipmentCreationAttributes>
  implements ShadowfaxReturnShipmentAttributes
{
  declare id: string;
  declare orderReturnId: string;
  declare status: ShadowfaxReturnShipmentStatus;
  declare shadowfaxOrderId: string | null;
  declare trackUrl: string | null;
  declare deliveryCost: number | null;
  declare clientCode: string;
  declare requestPayload: object | null;
  declare responsePayload: object | null;
  declare errorMessage: string | null;
  declare placedAt: Date | null;
  declare attemptCount: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ShadowfaxReturnShipment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    orderReturnId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'order_return_id',
    },
    status: {
      type: DataTypes.ENUM('pending', 'placed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    shadowfaxOrderId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'shadowfax_order_id',
    },
    trackUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'track_url',
    },
    deliveryCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'delivery_cost',
    },
    clientCode: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'client_code',
    },
    requestPayload: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'request_payload',
    },
    responsePayload: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'response_payload',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    placedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'placed_at',
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'attempt_count',
    },
  },
  {
    sequelize,
    tableName: 'shadowfax_return_shipments',
    underscored: true,
    indexes: [
      { unique: true, fields: ['order_return_id'] },
      { fields: ['shadowfax_order_id'] },
      { fields: ['status'] },
    ],
  },
);

export default ShadowfaxReturnShipment;
