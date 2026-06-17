import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface CouponUsageAttributes {
  id: string;
  couponId: string;
  userId: string;
  orderId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CouponUsageCreationAttributes
  extends Optional<CouponUsageAttributes, 'id'> {}

class CouponUsage
  extends Model<CouponUsageAttributes, CouponUsageCreationAttributes>
  implements CouponUsageAttributes
{
  declare id: string;
  declare couponId: string;
  declare userId: string;
  declare orderId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CouponUsage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    couponId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'coupon_id',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id',
    },
  },
  {
    sequelize,
    tableName: 'coupon_usages',
    underscored: false,
    indexes: [
      { fields: ['coupon_id', 'user_id'] },
      { fields: ['user_id'] },
      { unique: true, fields: ['order_id', 'coupon_id'], name: 'coupon_usages_order_id_coupon_id_unique' },
    ],
  },
);

export default CouponUsage;
