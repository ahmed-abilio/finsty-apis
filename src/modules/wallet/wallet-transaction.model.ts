import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type TransactionType = 'credit' | 'debit';
export type TransactionStatus = 'pending' | 'successful' | 'failed';
export type TransactionSource = 'topup' | 'order_payment' | 'refund' | 'withdrawal' | 'bonus' | 'referral_reward';

export interface WalletTransactionAttributes {
  id: string;
  walletId: string;
  reference: string;
  type: TransactionType;
  amount: number;
  fee: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  source: TransactionSource;
  provider: string | null;
  providerReference: string | null;
  metadata: object | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WalletTransactionCreationAttributes
  extends Optional<
    WalletTransactionAttributes,
    'id' | 'fee' | 'provider' | 'providerReference' | 'metadata'
  > {}

class WalletTransaction
  extends Model<WalletTransactionAttributes, WalletTransactionCreationAttributes>
  implements WalletTransactionAttributes
{
  declare id: string;
  declare walletId: string;
  declare reference: string;
  declare type: TransactionType;
  declare amount: number;
  declare fee: number;
  declare balanceBefore: number;
  declare balanceAfter: number;
  declare status: TransactionStatus;
  declare source: TransactionSource;
  declare provider: string | null;
  declare providerReference: string | null;
  declare metadata: object | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      walletId: this.walletId,
      reference: this.reference,
      type: this.type,
      amount: Number(this.amount),
      fee: Number(this.fee),
      balanceBefore: Number(this.balanceBefore),
      balanceAfter: Number(this.balanceAfter),
      status: this.status,
      source: this.source,
      provider: this.provider ?? null,
      providerReference: this.providerReference ?? null,
      metadata: this.metadata ?? null,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

WalletTransaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    walletId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'wallet_id',
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.ENUM('credit', 'debit'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    fee: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    balanceBefore: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'balance_before',
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'balance_after',
    },
    status: {
      type: DataTypes.ENUM('pending', 'successful', 'failed'),
      allowNull: false,
    },
    source: {
      type: DataTypes.ENUM('topup', 'order_payment', 'refund', 'withdrawal', 'bonus', 'referral_reward'),
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    providerReference: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: 'provider_reference',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'wallet_transactions',
    underscored: false,
    indexes: [
      { unique: true, fields: ['reference'] },
      { fields: ['wallet_id'] },
      { fields: ['status'] },
      { fields: ['source'] },
    ],
  },
);

export default WalletTransaction;
