import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type DeliveryType = 'delivery' | 'pickup';

export interface OrderAttributes {
  id: string;
  userId: string;
  addressId: string | null;
  status: OrderStatus;
  deliveryType: DeliveryType;
  subtotal: number;
  taxAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  notes: string | null;
  originalBasePrice: number;
  discountAmount: number;
  couponCode: string | null;
  metadata: object | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderCreationAttributes
  extends Optional<OrderAttributes, 'id' | 'addressId' | 'notes' | 'originalBasePrice' | 'discountAmount' | 'couponCode' | 'metadata'> {}

class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  declare id: string;
  declare userId: string;
  declare addressId: string | null;
  declare status: OrderStatus;
  declare deliveryType: DeliveryType;
  declare subtotal: number;
  declare taxAmount: number;
  declare deliveryCharge: number;
  declare totalAmount: number;
  declare notes: string | null;
  declare originalBasePrice: number;
  declare discountAmount: number;
  declare couponCode: string | null;
  declare metadata: object | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      userId: this.userId,
      addressId: this.addressId ?? null,
      status: this.status,
      deliveryType: this.deliveryType,
      subtotal: Number(this.subtotal),
      taxAmount: Number(this.taxAmount),
      deliveryCharge: Number(this.deliveryCharge),
      totalAmount: Number(this.totalAmount),
      notes: this.notes ?? null,
      originalBasePrice: Number(this.originalBasePrice),
      discountAmount: Number(this.discountAmount),
      couponCode: this.couponCode ?? null,
      metadata: this.metadata ?? null,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

Order.init(
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
    addressId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'address_id',
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    deliveryType: {
      type: DataTypes.ENUM('delivery', 'pickup'),
      allowNull: false,
      field: 'delivery_type',
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'tax_amount',
    },
    deliveryCharge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'delivery_charge',
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'total_amount',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    originalBasePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'original_base_price',
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'discount_amount',
    },
    couponCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'coupon_code',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'orders',
    underscored: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['delivery_type'] },
    ],
  },
);

export default Order;
