import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface WalletAttributes {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WalletCreationAttributes
  extends Optional<WalletAttributes, 'id' | 'balance' | 'currency' | 'isActive'> {}

class Wallet extends Model<WalletAttributes, WalletCreationAttributes> implements WalletAttributes {
  declare id: string;
  declare userId: string;
  declare balance: number;
  declare currency: string;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      userId: this.userId,
      balance: Number(this.balance),
      currency: this.currency,
      isActive: this.isActive,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

Wallet.init(
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
      unique: true,
      field: 'user_id',
    },
    balance: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'NGN',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'wallets',
    underscored: false,
    indexes: [{ unique: true, fields: ['user_id'] }],
  },
);

export default Wallet;
