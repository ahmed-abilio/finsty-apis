import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface OrderItemAttributes {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  basePrice: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  discountedBasePrice: number | null;
  additionalPrice: number | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItemCreationAttributes
  extends Optional<
    OrderItemAttributes,
    | 'id'
    | 'variantId'
    | 'variantLabel'
    | 'basePrice'
    | 'discountPercent'
    | 'discountAmount'
    | 'discountedBasePrice'
    | 'additionalPrice'
  > {}

class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes>
  implements OrderItemAttributes {
  declare id: string;
  declare orderId: string;
  declare productId: string;
  declare variantId: string | null;
  declare productName: string;
  declare variantLabel: string | null;
  declare basePrice: number | null;
  declare discountPercent: number | null;
  declare discountAmount: number | null;
  declare discountedBasePrice: number | null;
  declare additionalPrice: number | null;
  declare unitPrice: number;
  declare quantity: number;
  declare totalPrice: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const num = (val: number | null | undefined) =>
      val === null || val === undefined ? null : Number(val);

    return {
      id: this.id,
      orderId: this.orderId,
      productId: this.productId,
      variantId: this.variantId ?? null,
      productName: this.productName,
      variantLabel: this.variantLabel ?? null,
      basePrice: num(this.basePrice),
      discountPercent: num(this.discountPercent),
      discountAmount: num(this.discountAmount),
      discountedBasePrice: num(this.discountedBasePrice),
      additionalPrice: num(this.additionalPrice),
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
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'base_price',
    },
    discountPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'discount_percent',
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'discount_amount',
    },
    discountedBasePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'discounted_base_price',
    },
    additionalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'additional_price',
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
