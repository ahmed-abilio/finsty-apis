import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type PaymentStatus =
  | 'pending'
  | 'captured'
  | 'failed'
  | 'refund_requested'
  | 'refunded';

export type PaymentType = 'card' | 'upi' | 'netbanking' | 'wallet' | 'other';

export interface PaymentAttributes {
  id: string;
  orderId: string | null;
  walletId: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  providerSignature: string | null;
  paymentType: PaymentType | null;
  refundRequestedAt: Date | null;
  refundProcessedAt: Date | null;
  refundNote: string | null;
  metadata: object | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentCreationAttributes
  extends Optional<
    PaymentAttributes,
    | 'id'
    | 'orderId'
    | 'providerPaymentId'
    | 'providerSignature'
    | 'paymentType'
    | 'refundRequestedAt'
    | 'refundProcessedAt'
    | 'refundNote'
    | 'metadata'
  > {}

class Payment
  extends Model<PaymentAttributes, PaymentCreationAttributes>
  implements PaymentAttributes
{
  declare id: string;
  declare orderId: string | null;
  declare walletId: string;
  declare userId: string;
  declare amount: number;
  declare currency: string;
  declare status: PaymentStatus;
  declare provider: string;
  declare providerOrderId: string;
  declare providerPaymentId: string | null;
  declare providerSignature: string | null;
  declare paymentType: PaymentType | null;
  declare refundRequestedAt: Date | null;
  declare refundProcessedAt: Date | null;
  declare refundNote: string | null;
  declare metadata: object | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      orderId: this.orderId ?? null,
      walletId: this.walletId,
      userId: this.userId,
      amount: Number(this.amount),
      currency: this.currency,
      status: this.status,
      provider: this.provider,
      providerOrderId: this.providerOrderId,
      providerPaymentId: this.providerPaymentId ?? null,
      paymentType: this.paymentType ?? null,
      // Never expose signature to clients
      refundRequestedAt: this.refundRequestedAt?.toISOString?.() ?? null,
      refundProcessedAt: this.refundProcessedAt?.toISOString?.() ?? null,
      refundNote: this.refundNote ?? null,
      metadata: this.metadata ?? null,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'order_id',
    },
    walletId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'wallet_id',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'INR',
    },
    status: {
      type: DataTypes.ENUM('pending', 'captured', 'failed', 'refund_requested', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    providerOrderId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'provider_order_id',
    },
    providerPaymentId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'provider_payment_id',
    },
    providerSignature: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'provider_signature',
    },
    paymentType: {
      type: DataTypes.ENUM('card', 'upi', 'netbanking', 'wallet', 'other'),
      allowNull: true,
      field: 'payment_type',
    },
    refundRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refund_requested_at',
    },
    refundProcessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refund_processed_at',
    },
    refundNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refund_note',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'payments',
    underscored: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['order_id'] },
      { fields: ['wallet_id'] },
      { fields: ['status'] },
      { unique: true, fields: ['provider_order_id'] },
      { fields: ['provider_payment_id'] },
    ],
  },
);

export default Payment;
