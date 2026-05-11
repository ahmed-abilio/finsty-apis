import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type AddressLabel = 'home' | 'hotel' | 'work' | 'others';

export interface AddressAttributes {
  id: string;
  userId: string;
  label: AddressLabel | null;
  receiverName: string;
  receiverPhone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AddressCreationAttributes
  extends Optional<AddressAttributes, 'id' | 'label' | 'line2' | 'latitude' | 'longitude' | 'isDefault'> {}

class Address extends Model<AddressAttributes, AddressCreationAttributes>
  implements AddressAttributes {
  declare id: string;
  declare userId: string;
  declare label: AddressLabel | null;
  declare receiverName: string;
  declare receiverPhone: string;
  declare line1: string;
  declare line2: string | null;
  declare city: string;
  declare state: string;
  declare postalCode: string;
  declare country: string;
  declare latitude: number | null;
  declare longitude: number | null;
  declare isDefault: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      userId: this.userId,
      label: this.label ?? null,
      receiverName: this.receiverName,
      receiverPhone: this.receiverPhone,
      line1: this.line1,
      line2: this.line2 ?? null,
      city: this.city,
      state: this.state,
      postalCode: this.postalCode,
      country: this.country,
      latitude: this.latitude !== null ? Number(this.latitude) : null,
      longitude: this.longitude !== null ? Number(this.longitude) : null,
      isDefault: this.isDefault,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

Address.init(
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
    label: {
      type: DataTypes.ENUM('home', 'hotel', 'work', 'others'),
      allowNull: true,
    },
    receiverName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'receiver_name',
    },
    receiverPhone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'receiver_phone',
    },
    line1: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    line2: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'line2',
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'postal_code',
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'India',
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default',
    },
  },
  {
    sequelize,
    tableName: 'addresses',
    underscored: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'is_default'] },
    ],
  },
);

export default Address;
