import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type CouponType = 'FLAT' | 'PERCENTAGE' | 'FREE_DELIVERY';
export type CouponAppliesTo = 'all_products' | 'specific_products' | 'specific_categories';
export type CouponMinimumRequirement = 'none' | 'minimum_order_value' | 'minimum_quantity';
export type CouponCustomerEligibility = 'everyone' | 'first_order_only' | 'specific_customers';

export interface CouponAttributes {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderValue: number;
  maxDiscountCap: number | null;
  validFrom: Date;
  validTo: Date;
  usageLimitTotal: number | null;
  usageLimitPerUser: number | null;
  isStackable: boolean;
  isFirstOrderOnly: boolean;
  storeId: string | null;
  categoryId: string | null;
  isApproved: boolean;
  isActive: boolean;
  readyToUse: boolean;
  createdBy: string;
  appliesTo: CouponAppliesTo;
  minimumRequirement: CouponMinimumRequirement;
  customerEligibility: CouponCustomerEligibility;
  // JSONB arrays for scoped targeting
  productIds: string[] | null;
  categoryIds: string[] | null;
  customerIds: string[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CouponCreationAttributes
  extends Optional<
    CouponAttributes,
    | 'id'
    | 'minOrderValue'
    | 'maxDiscountCap'
    | 'usageLimitTotal'
    | 'usageLimitPerUser'
    | 'isStackable'
    | 'isFirstOrderOnly'
    | 'storeId'
    | 'categoryId'
    | 'isApproved'
    | 'isActive'
    | 'readyToUse'
    | 'appliesTo'
    | 'minimumRequirement'
    | 'customerEligibility'
    | 'productIds'
    | 'categoryIds'
    | 'customerIds'
  > {}

class Coupon extends Model<CouponAttributes, CouponCreationAttributes> implements CouponAttributes {
  declare id: string;
  declare code: string;
  declare type: CouponType;
  declare value: number;
  declare minOrderValue: number;
  declare maxDiscountCap: number | null;
  declare validFrom: Date;
  declare validTo: Date;
  declare usageLimitTotal: number | null;
  declare usageLimitPerUser: number | null;
  declare isStackable: boolean;
  declare isFirstOrderOnly: boolean;
  declare storeId: string | null;
  declare categoryId: string | null;
  declare isApproved: boolean;
  declare isActive: boolean;
  declare readyToUse: boolean;
  declare createdBy: string;
  declare appliesTo: CouponAppliesTo;
  declare minimumRequirement: CouponMinimumRequirement;
  declare customerEligibility: CouponCustomerEligibility;
  declare productIds: string[] | null;
  declare categoryIds: string[] | null;
  declare customerIds: string[] | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = ((this as unknown as { dataValues?: Record<string, unknown> }).dataValues ??
      {}) as Record<string, unknown>;

    const safeNumber = (val: any) => {
      if (val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const formatDate = (val: any) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const readBool = (camel: string, snake: string, fallback = false): boolean => {
      const value = this.get(camel) ?? raw[camel] ?? raw[snake];
      return value === undefined ? fallback : Boolean(value);
    };

    return {
      id: this.get('id'),
      code: this.get('code'),
      type: this.get('type'),
      value: safeNumber(this.get('value')) ?? 0,
      minOrderValue: safeNumber(this.get('minOrderValue')) ?? 0,
      maxDiscountCap: safeNumber(this.get('maxDiscountCap')),
      validFrom: formatDate(this.get('validFrom')),
      validTo: formatDate(this.get('validTo')),
      usageLimitTotal: safeNumber(this.get('usageLimitTotal')),
      usageLimitPerUser: safeNumber(this.get('usageLimitPerUser')),
      isStackable: readBool('isStackable', 'is_stackable'),
      isFirstOrderOnly: readBool('isFirstOrderOnly', 'is_first_order_only'),
      storeId: this.get('storeId') ?? raw.storeId ?? raw.store_id ?? null,
      categoryId: this.get('categoryId') ?? raw.categoryId ?? raw.category_id ?? null,
      isApproved: readBool('isApproved', 'is_approved'),
      isActive: readBool('isActive', 'is_active', true),
      readyToUse: readBool('readyToUse', 'ready_to_use'),
      createdBy: this.get('createdBy'),
      appliesTo: this.get('appliesTo') ?? 'all_products',
      minimumRequirement: this.get('minimumRequirement') ?? 'none',
      customerEligibility: this.get('customerEligibility') ?? 'everyone',
      productIds: (this.get('productIds') as string[] | null) ?? null,
      categoryIds: (this.get('categoryIds') as string[] | null) ?? null,
      customerIds: (this.get('customerIds') as string[] | null) ?? null,
      createdAt: formatDate(this.get('createdAt')),
      updatedAt: formatDate(this.get('updatedAt')),
    };
  }
}

Coupon.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.ENUM('FLAT', 'PERCENTAGE', 'FREE_DELIVERY'),
      allowNull: false,
    },
    value: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    minOrderValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'min_order_value',
    },
    maxDiscountCap: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'max_discount_cap',
    },
    validFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'valid_from',
    },
    validTo: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'valid_to',
    },
    usageLimitTotal: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'usage_limit_total',
    },
    usageLimitPerUser: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'usage_limit_per_user',
    },
    isStackable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_stackable',
    },
    isFirstOrderOnly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_first_order_only',
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'store_id',
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'category_id',
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_approved',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    readyToUse: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'ready_to_use',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
    },
    appliesTo: {
      type: DataTypes.ENUM('all_products', 'specific_products', 'specific_categories'),
      allowNull: false,
      defaultValue: 'all_products',
      field: 'applies_to',
    },
    minimumRequirement: {
      type: DataTypes.ENUM('none', 'minimum_order_value', 'minimum_quantity'),
      allowNull: false,
      defaultValue: 'none',
      field: 'minimum_requirement',
    },
    customerEligibility: {
      type: DataTypes.ENUM('everyone', 'first_order_only', 'specific_customers'),
      allowNull: false,
      defaultValue: 'everyone',
      field: 'customer_eligibility',
    },
    productIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      field: 'product_ids',
    },
    categoryIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      field: 'category_ids',
    },
    customerIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      field: 'customer_ids',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'coupons',
    underscored: true,
    indexes: [
      { fields: ['code'], unique: true },
      { fields: ['store_id'] },
      { fields: ['category_id'] },
      { fields: ['is_approved'] },
      { fields: ['is_active'] },
      { fields: ['valid_from', 'valid_to'] },
    ],
  },
);

export default Coupon;
