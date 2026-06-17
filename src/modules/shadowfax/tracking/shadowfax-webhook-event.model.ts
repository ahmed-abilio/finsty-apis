import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface ShadowfaxWebhookEventAttributes {
  id: string;
  eventKey: string;
  sfxOrderId: number | null;
  clientOrderId: string | null;
  status: string | null;
  payload: object;
  processed: boolean;
  processedAt: Date | null;
  remarks: string | null;
  createdAt?: Date;
}

export interface ShadowfaxWebhookEventCreationAttributes
  extends Optional<
    ShadowfaxWebhookEventAttributes,
    'id' | 'sfxOrderId' | 'clientOrderId' | 'status' | 'processed' | 'processedAt' | 'remarks'
  > {}

class ShadowfaxWebhookEvent
  extends Model<ShadowfaxWebhookEventAttributes, ShadowfaxWebhookEventCreationAttributes>
  implements ShadowfaxWebhookEventAttributes
{
  declare id: string;
  declare eventKey: string;
  declare sfxOrderId: number | null;
  declare clientOrderId: string | null;
  declare status: string | null;
  declare payload: object;
  declare processed: boolean;
  declare processedAt: Date | null;
  declare remarks: string | null;
  declare readonly createdAt: Date;
}

ShadowfaxWebhookEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'event_key',
    },
    sfxOrderId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'sfx_order_id',
    },
    clientOrderId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'client_order_id',
    },
    status: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'shadowfax_webhook_events',
    underscored: true,
    updatedAt: false,
    indexes: [
      { unique: true, fields: ['event_key'] },
      { fields: ['client_order_id'] },
    ],
  },
);

export default ShadowfaxWebhookEvent;
