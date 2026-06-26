import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'rider_assigned'
  | 'at_store'
  | 'picked_up'
  | 'arrived'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type DeliveryType = 'delivery' | 'pickup';

export interface OrderAttributes {
  id: string;
  orderId: string;
  userId: string;
  addressId: string | null;
  status: OrderStatus;
  deliveryType: DeliveryType;
  subtotal: number;
  taxAmount: number;
  platformFee: number;
  deliveryCharge: number;
  totalAmount: number;
  notes: string | null;
  originalBasePrice: number;
  discountAmount: number;
  couponCode: string | null;
  metadata: object | null;
  shadowfaxOrderId: number | null;
  shadowfaxTrackingUrl: string | null;
  deliveryPartner: string;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  returnedAt: Date | null;
  riderId: number | null;
  riderName: string | null;
  riderPhone: string | null;
  deliveryMetadata: object | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderCreationAttributes
  extends Optional<
    OrderAttributes,
    | 'id'
    | 'orderId'
    | 'addressId'
    | 'notes'
    | 'originalBasePrice'
    | 'discountAmount'
    | 'couponCode'
    | 'metadata'
    | 'platformFee'
    | 'shadowfaxOrderId'
    | 'shadowfaxTrackingUrl'
    | 'deliveryPartner'
    | 'deliveredAt'
    | 'cancelledAt'
    | 'returnedAt'
    | 'riderId'
    | 'riderName'
    | 'riderPhone'
    | 'deliveryMetadata'
  > {}

class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  declare id: string;
  declare orderId: string;
  declare userId: string;
  declare addressId: string | null;
  declare status: OrderStatus;
  declare deliveryType: DeliveryType;
  declare subtotal: number;
  declare taxAmount: number;
  declare platformFee: number;
  declare deliveryCharge: number;
  declare totalAmount: number;
  declare notes: string | null;
  declare originalBasePrice: number;
  declare discountAmount: number;
  declare couponCode: string | null;
  declare metadata: object | null;
  declare shadowfaxOrderId: number | null;
  declare shadowfaxTrackingUrl: string | null;
  declare deliveryPartner: string;
  declare deliveredAt: Date | null;
  declare cancelledAt: Date | null;
  declare returnedAt: Date | null;
  declare riderId: number | null;
  declare riderName: string | null;
  declare riderPhone: string | null;
  declare deliveryMetadata: object | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): Record<string, unknown> {
    return {
      id: this.id,
      orderId: this.orderId,
      userId: this.userId,
      addressId: this.addressId ?? null,
      status: this.status,
      deliveryType: this.deliveryType,
      subtotal: Number(this.subtotal),
      taxAmount: Number(this.taxAmount),
      platformFee: Number(this.platformFee),
      deliveryCharge: Number(this.deliveryCharge),
      totalAmount: Number(this.totalAmount),
      notes: this.notes ?? null,
      originalBasePrice: Number(this.originalBasePrice),
      discountAmount: Number(this.discountAmount),
      couponCode: this.couponCode ?? null,
      metadata: this.metadata ?? null,
      shadowfaxOrderId: this.shadowfaxOrderId != null ? Number(this.shadowfaxOrderId) : null,
      shadowfaxTrackingUrl: this.shadowfaxTrackingUrl ?? null,
      deliveryPartner: this.deliveryPartner,
      deliveredAt: this.deliveredAt?.toISOString?.() ?? null,
      cancelledAt: this.cancelledAt?.toISOString?.() ?? null,
      returnedAt: this.returnedAt?.toISOString?.() ?? null,
      riderId: this.riderId != null ? Number(this.riderId) : null,
      riderName: this.riderName ?? null,
      riderPhone: this.riderPhone ?? null,
      deliveryMetadata: this.deliveryMetadata ?? null,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

function generateOrderIdCode(): string {
  const now = new Date();
  const epochPart = Date.now().toString(36).toUpperCase().slice(-6).padStart(6, '0');
  const msPart = String(now.getMilliseconds()).padStart(3, '0');
  return `FI${epochPart}${msPart}0`;
}

Order.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      unique: true,
      field: 'order_id',
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
      type: DataTypes.STRING(50),
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
    platformFee: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'platform_fee',
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
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'coupon_code',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    shadowfaxOrderId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'shadowfax_order_id',
    },
    shadowfaxTrackingUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'shadowfax_tracking_url',
    },
    deliveryPartner: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'SHADOWFAX',
      field: 'delivery_partner',
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'delivered_at',
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'cancelled_at',
    },
    returnedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'returned_at',
    },
    riderId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'rider_id',
    },
    riderName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'rider_name',
    },
    riderPhone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'rider_phone',
    },
    deliveryMetadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'delivery_metadata',
    },
  },
  {
    sequelize,
    tableName: 'orders',
    underscored: false,
    hooks: {
      beforeValidate: (order: Order) => {
        if (!order.orderId) {
          order.orderId = generateOrderIdCode();
        }
      },
    },
    indexes: [
      { unique: true, fields: ['order_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['delivery_type'] },
      { fields: ['shadowfax_order_id'] },
    ],
  },
);

export default Order;
