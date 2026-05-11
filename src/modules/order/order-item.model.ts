import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface OrderItemAttributes {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItemCreationAttributes
  extends Optional<OrderItemAttributes, 'id' | 'variantId' | 'variantLabel'> {}

class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes>
  implements OrderItemAttributes {
  declare id: string;
  declare orderId: string;
  declare productId: string;
  declare variantId: string | null;
  declare productName: string;
  declare variantLabel: string | null;
  declare unitPrice: number;
  declare quantity: number;
  declare totalPrice: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      orderId: this.orderId,
      productId: this.productId,
      variantId: this.variantId ?? null,
      productName: this.productName,
      variantLabel: this.variantLabel ?? null,
      unitPrice: Number(this.unitPrice),
      quantity: this.quantity,
      totalPrice: Number(this.totalPrice),
    };
  }
}

OrderItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id',
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id',
    },
    variantId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'variant_id',
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'product_name',
    },
    variantLabel: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'variant_label',
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'unit_price',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    totalPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'total_price',
    },
  },
  {
    sequelize,
    tableName: 'order_items',
    underscored: false,
    indexes: [{ fields: ['order_id'] }],
  },
);

export default OrderItem;
