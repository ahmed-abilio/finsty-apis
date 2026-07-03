import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface OrderReturnItemAttributes {
  id: string;
  orderReturnId: string;
  orderItemId: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderReturnItemCreationAttributes
  extends Optional<OrderReturnItemAttributes, 'id'> {}

class OrderReturnItem
  extends Model<OrderReturnItemAttributes, OrderReturnItemCreationAttributes>
  implements OrderReturnItemAttributes
{
  declare id: string;
  declare orderReturnId: string;
  declare orderItemId: string;
  declare quantity: number;
  declare unitPrice: number;
  declare refundAmount: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): Record<string, unknown> {
    return {
      id: this.id,
      orderReturnId: this.orderReturnId,
      orderItemId: this.orderItemId,
      quantity: this.quantity,
      unitPrice: Number(this.unitPrice),
      refundAmount: Number(this.refundAmount),
    };
  }
}

OrderReturnItem.init(
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
      field: 'order_return_id',
    },
    orderItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_item_id',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'unit_price',
    },
    refundAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'refund_amount',
    },
  },
  {
    sequelize,
    tableName: 'order_return_items',
    underscored: true,
    indexes: [
      { fields: ['order_return_id'] },
      { fields: ['order_item_id'] },
    ],
  },
);

export default OrderReturnItem;
