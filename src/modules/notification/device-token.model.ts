import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';
import type { Roles } from '@modules/user/user.model';

export type DevicePlatform = 'ios' | 'android';

export interface DeviceTokenAttributes {
  id: string;
  userId: string;
  role: Roles;
  platform: DevicePlatform;
  token: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DeviceTokenCreationAttributes
  extends Optional<DeviceTokenAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class DeviceToken
  extends Model<DeviceTokenAttributes, DeviceTokenCreationAttributes>
  implements DeviceTokenAttributes
{
  declare id: string;
  declare userId: string;
  declare role: Roles;
  declare platform: DevicePlatform;
  declare token: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

DeviceToken.init(
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
    role: {
      type: DataTypes.ENUM('user', 'vendor', 'admin'),
      allowNull: false,
    },
    platform: {
      type: DataTypes.ENUM('ios', 'android'),
      allowNull: false,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'device_tokens',
    underscored: false,
    indexes: [
      { fields: ['user_id', 'role'] },
      { unique: true, fields: ['user_id', 'role', 'token'], name: 'device_tokens_user_role_token_unique' },
    ],
  },
);

export default DeviceToken;
