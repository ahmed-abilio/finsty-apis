import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type OrderReturnStatus =
  | 'requested'
  | 'pickup_scheduled'
  | 'rider_assigned'
  | 'at_store'
  | 'picked_up'
  | 'arrived'
  | 'received_at_store'
  | 'pending_inspection'
  | 'refund_approved'
  | 'refund_rejected'
  | 'cancelled';

export type OrderReturnLogisticsStatus =
  | 'requested'
  | 'pickup_scheduled'
  | 'rider_assigned'
  | 'at_store'
  | 'picked_up'
  | 'arrived'
  | 'delivered';

export const ACTIVE_ORDER_RETURN_STATUSES: OrderReturnStatus[] = [
  'requested',
  'pickup_scheduled',
  'rider_assigned',
  'at_store',
  'picked_up',
  'arrived',
  'received_at_store',
  'pending_inspection',
];

export interface OrderReturnAttributes {
  id: string;
  orderId: string;
  userId: string;
  storeId: string;
  status: OrderReturnStatus;
  logisticsStatus: OrderReturnLogisticsStatus | null;
  reason: string | null;
  rejectionReason: string | null;
  refundAmount: number | null;
  shadowfaxOrderId: string | null;
  shadowfaxTrackingUrl: string | null;
  deliveryMetadata: object | null;
  riderId: number | null;
  riderName: string | null;
  riderPhone: string | null;
  requestedAt: Date;
  receivedAtStoreAt: Date | null;
  inspectedAt: Date | null;
  refundProcessedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderReturnCreationAttributes
  extends Optional<
    OrderReturnAttributes,
    | 'id'
    | 'logisticsStatus'
    | 'reason'
    | 'rejectionReason'
    | 'refundAmount'
    | 'shadowfaxOrderId'
    | 'shadowfaxTrackingUrl'
    | 'deliveryMetadata'
    | 'riderId'
    | 'riderName'
    | 'riderPhone'
    | 'requestedAt'
    | 'receivedAtStoreAt'
    | 'inspectedAt'
    | 'refundProcessedAt'
  > {}

class OrderReturn
  extends Model<OrderReturnAttributes, OrderReturnCreationAttributes>
  implements OrderReturnAttributes
{
  declare id: string;
  declare orderId: string;
  declare userId: string;
  declare storeId: string;
  declare status: OrderReturnStatus;
  declare logisticsStatus: OrderReturnLogisticsStatus | null;
  declare reason: string | null;
  declare rejectionReason: string | null;
  declare refundAmount: number | null;
  declare shadowfaxOrderId: string | null;
  declare shadowfaxTrackingUrl: string | null;
  declare deliveryMetadata: object | null;
  declare riderId: number | null;
  declare riderName: string | null;
  declare riderPhone: string | null;
  declare requestedAt: Date;
  declare receivedAtStoreAt: Date | null;
  declare inspectedAt: Date | null;
  declare refundProcessedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): Record<string, unknown> {
    return {
      id: this.id,
      orderId: this.orderId,
      userId: this.userId,
      storeId: this.storeId,
      status: this.status,
      logisticsStatus: this.logisticsStatus ?? null,
      reason: this.reason ?? null,
      rejectionReason: this.rejectionReason ?? null,
      refundAmount: this.refundAmount != null ? Number(this.refundAmount) : null,
      shadowfaxOrderId: this.shadowfaxOrderId ?? null,
      shadowfaxTrackingUrl: this.shadowfaxTrackingUrl ?? null,
      deliveryMetadata: this.deliveryMetadata ?? null,
      riderId: this.riderId ?? null,
      riderName: this.riderName ?? null,
      riderPhone: this.riderPhone ?? null,
      requestedAt: this.requestedAt,
      receivedAtStoreAt: this.receivedAtStoreAt ?? null,
      inspectedAt: this.inspectedAt ?? null,
      refundProcessedAt: this.refundProcessedAt ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

OrderReturn.init(
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'store_id',
    },
    status: {
      type: DataTypes.ENUM(
        'requested',
        'pickup_scheduled',
        'rider_assigned',
        'at_store',
        'picked_up',
        'arrived',
        'received_at_store',
        'pending_inspection',
        'refund_approved',
        'refund_rejected',
        'cancelled',
      ),
      allowNull: false,
      defaultValue: 'requested',
    },
    logisticsStatus: {
      type: DataTypes.ENUM(
        'requested',
        'pickup_scheduled',
        'rider_assigned',
        'at_store',
        'picked_up',
        'arrived',
        'delivered',
      ),
      allowNull: true,
      field: 'logistics_status',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason',
    },
    refundAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'refund_amount',
    },
    shadowfaxOrderId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'shadowfax_order_id',
    },
    shadowfaxTrackingUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'shadowfax_tracking_url',
    },
    deliveryMetadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'delivery_metadata',
    },
    riderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'rider_id',
    },
    riderName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'rider_name',
    },
    riderPhone: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'rider_phone',
    },
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'requested_at',
    },
    receivedAtStoreAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'received_at_store_at',
    },
    inspectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'inspected_at',
    },
    refundProcessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refund_processed_at',
    },
  },
  {
    sequelize,
    tableName: 'order_returns',
    underscored: true,
    indexes: [
      { fields: ['order_id'] },
      { fields: ['store_id', 'status'] },
      { fields: ['user_id'] },
    ],
  },
);

export default OrderReturn;
