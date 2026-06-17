import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface PlatformSettingAttributes {
  key: string;
  value: unknown;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PlatformSettingCreationAttributes = Optional<
  PlatformSettingAttributes,
  'description' | 'createdAt' | 'updatedAt'
>;

class PlatformSetting
  extends Model<PlatformSettingAttributes, PlatformSettingCreationAttributes>
  implements PlatformSettingAttributes
{
  declare key: string;
  declare value: unknown;
  declare description: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

PlatformSetting.init(
  {
    key: {
      type: DataTypes.STRING(128),
      primaryKey: true,
      allowNull: false,
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'platform_settings',
    underscored: false,
    timestamps: true,
  },
);

export default PlatformSetting;
