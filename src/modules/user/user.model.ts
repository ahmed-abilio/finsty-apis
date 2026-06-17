import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';
import { AuthProvider } from '@types-app/index';

// ─── Attribute interfaces ──────────────────────────────────────────────────────
export enum Roles {
  USER = 'user',
  ADMIN = 'admin',
  VENDOR = 'vendor'
}
export interface UserAttributes {
  id: string;
  firebaseUid: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  profileImage: string | null;
  role: Roles;
  provider: AuthProvider;
  isActive: boolean;
  ipAddress: string | null;
  referralCode: string;
  referredById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes
  extends Optional<UserAttributes, 'id' | 'isActive' | 'name' | 'phone' | 'email' | 'profileImage' | 'ipAddress' | 'referralCode' | 'referredById'> {}

// ─── Model class ──────────────────────────────────────────────────────────────

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare firebaseUid: string;
  declare name: string | null;
  declare phone: string | null;
  declare email: string | null;
  declare profileImage: string | null;
  declare provider: AuthProvider;
  declare isActive: boolean;
  declare role: Roles;
  declare ipAddress: string | null;
  declare referralCode: string;
  declare referredById: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  /**
   * Safe JSON serialization — returns a plain object with all fields as
   * primitives so fast-json-stringify can serialize without silent drops.
   * Date fields are converted to ISO strings; nulls are preserved.
   */
  toPublicJSON(): any {
    // dataValues is the raw storage in a Sequelize instance
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      firebaseUid: this.firebaseUid || raw.firebaseUid || raw.firebase_uid || '',
      name: this.name ?? raw.name ?? null,
      phone: this.phone || raw.phone || null,
      email: this.email || raw.email || null,
      profileImage: this.profileImage || raw.profileImage || raw.profile_image || null,
      provider: this.provider || raw.provider || 'phone',
      role: this.role || raw.role || 'user',
      isActive: this.isActive ?? raw.isActive ?? raw.is_active ?? true,
      ipAddress: this.ipAddress ?? raw.ipAddress ?? raw.ip_address ?? null,
      createdAt: (this.createdAt || raw.createdAt) ? new Date(this.createdAt || raw.createdAt).toISOString() : '',
      updatedAt: (this.updatedAt || raw.updatedAt) ? new Date(this.updatedAt || raw.updatedAt).toISOString() : '',
      ip: this.ipAddress ?? raw.ipAddress ?? raw.ip_address ?? null,
      referralCode: this.referralCode || raw.referralCode || raw.referral_code || '',
      referralAmount: parseFloat(process.env.REFERRAL_REWARD_AMOUNT ?? '100'),
      referredById: this.referredById ?? raw.referredById ?? raw.referred_by_id ?? null,
    };
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    firebaseUid: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      field: 'firebase_uid',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    profileImage: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'profile_image',
    },
    role: {
      type: DataTypes.ENUM(...Object.values(Roles)),
      allowNull: false,
      defaultValue: Roles.USER,
    },
    provider: {
      type: DataTypes.ENUM('phone', 'google', 'apple'),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
    referralCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      field: 'referral_code',
    },
    referredById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'referred_by_id',
    },
  },
  {
    sequelize,
    tableName: 'user_users',
    underscored: false,
    indexes: [
      { fields: ['firebase_uid'], unique: true },
      { fields: ['email'] },
      { fields: ['phone'] },
      { fields: ['referral_code'], unique: true },
      { fields: ['referred_by_id'] },
    ],
  },
);

export default User;
