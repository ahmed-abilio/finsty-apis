import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendingOrderStatus = 'queued' | 'processing' | 'success' | 'failed';

export interface PendingOrderAttributes {
  id: string;
  userId: string;
  jobId: string | null;
  status: PendingOrderStatus;
  orderId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PendingOrderCreationAttributes
  extends Optional<
    PendingOrderAttributes,
    'id' | 'jobId' | 'orderId' | 'failureCode' | 'failureMessage'
  > {}

// ─── Model ────────────────────────────────────────────────────────────────────

class PendingOrder
  extends Model<PendingOrderAttributes, PendingOrderCreationAttributes>
  implements PendingOrderAttributes
{
  declare id: string;
  declare userId: string;
  declare jobId: string | null;
  declare status: PendingOrderStatus;
  declare orderId: string | null;
  declare failureCode: string | null;
  declare failureMessage: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      userId: this.userId,
      jobId: this.jobId ?? null,
      status: this.status,
      orderId: this.orderId ?? null,
      failureCode: this.failureCode ?? null,
      failureMessage: this.failureMessage ?? null,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

PendingOrder.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    jobId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'job_id',
    },
    status: {
      type: DataTypes.ENUM('queued', 'processing', 'success', 'failed'),
      allowNull: false,
      defaultValue: 'queued',
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'order_id',
    },
    failureCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'failure_code',
    },
    failureMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'failure_message',
    },
  },
  {
    sequelize,
    tableName: 'pending_orders',
    underscored: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['job_id'] },
      { fields: ['status'] },
    ],
  },
);

export default PendingOrder;
