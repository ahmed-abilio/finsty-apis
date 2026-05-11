import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Price Banner ─────────────────────────────────────────────────────────────

export interface PriceBannerAttributes {
  id: string;
  title: string;
  imageUrl: string;
  priceThreshold: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PriceBannerCreationAttributes
  extends Optional<PriceBannerAttributes, 'id' | 'isActive'> {}

export class PriceBanner
  extends Model<PriceBannerAttributes, PriceBannerCreationAttributes>
  implements PriceBannerAttributes
{
  declare id: string;
  declare title: string;
  declare imageUrl: string;
  declare priceThreshold: number;
  declare isActive: boolean;
  declare createdBy: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
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

    return {
      id: this.get('id'),
      title: this.get('title'),
      imageUrl: this.get('imageUrl'),
      priceThreshold: safeNumber(this.get('priceThreshold')) ?? 0,
      isActive: !!this.get('isActive'),
      createdBy: this.get('createdBy'),
      createdAt: formatDate(this.get('createdAt')),
      updatedAt: formatDate(this.get('updatedAt')),
    };
  }
}

PriceBanner.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'image_url',
    },
    priceThreshold: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'price_threshold',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
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
    tableName: 'price_banners',
    underscored: true,
    indexes: [{ fields: ['is_active'] }],
  },
);

// ─── Store Discount Banner ────────────────────────────────────────────────────

export interface StoreDiscountBannerAttributes {
  id: string;
  storeId: string;
  title: string;
  imageUrl: string;
  discountPercentage: number;
  isActive: boolean;
  isApproved: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoreDiscountBannerCreationAttributes
  extends Optional<StoreDiscountBannerAttributes, 'id' | 'isActive' | 'isApproved'> {}

export class StoreDiscountBanner
  extends Model<StoreDiscountBannerAttributes, StoreDiscountBannerCreationAttributes>
  implements StoreDiscountBannerAttributes
{
  declare id: string;
  declare storeId: string;
  declare title: string;
  declare imageUrl: string;
  declare discountPercentage: number;
  declare isActive: boolean;
  declare isApproved: boolean;
  declare createdBy: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
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

    return {
      id: this.get('id'),
      storeId: this.get('storeId'),
      title: this.get('title'),
      imageUrl: this.get('imageUrl'),
      discountPercentage: safeNumber(this.get('discountPercentage')) ?? 0,
      isActive: !!this.get('isActive'),
      isApproved: !!this.get('isApproved'),
      createdBy: this.get('createdBy'),
      createdAt: formatDate(this.get('createdAt')),
      updatedAt: formatDate(this.get('updatedAt')),
    };
  }
}

StoreDiscountBanner.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'store_id',
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'image_url',
    },
    discountPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      field: 'discount_percentage',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_approved',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
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
    tableName: 'store_discount_banners',
    underscored: true,
    indexes: [
      { fields: ['store_id'] },
      { fields: ['is_active'] },
      { fields: ['is_approved'] },
    ],
  },
);
