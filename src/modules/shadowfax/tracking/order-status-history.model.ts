import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface OrderStatusHistoryAttributes {
  id: string;
  orderId: string;
  oldStatus: string;
  newStatus: string;
  source: string;
  remarks: string | null;
  payload: object | null;
  createdAt?: Date;
}

export interface OrderStatusHistoryCreationAttributes
  extends Optional<OrderStatusHistoryAttributes, 'id' | 'remarks' | 'payload'> {}

class OrderStatusHistory
  extends Model<OrderStatusHistoryAttributes, OrderStatusHistoryCreationAttributes>
  implements OrderStatusHistoryAttributes
{
  declare id: string;
  declare orderId: string;
  declare oldStatus: string;
  declare newStatus: string;
  declare source: string;
  declare remarks: string | null;
  declare payload: object | null;
  declare readonly createdAt: Date;
}

OrderStatusHistory.init(
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
    oldStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'old_status',
    },
    newStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'new_status',
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'order_status_history',
    underscored: true,
    updatedAt: false,
    indexes: [{ fields: ['order_id'] }],
  },
);

export default OrderStatusHistory;
