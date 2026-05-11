import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';
import type { StoreGender } from '@modules/store/store.model';

export type ProductStatus = 'draft' | 'active';

export interface ProductAttributes {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  gender: StoreGender | null;
  categoryType: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  basePrice: number;
  discountPercent: number;
  discountStartDate: Date | null;
  discountEndDate: Date | null;
  isActive: boolean;
  inStock: boolean;
  lowStockThreshold: number;
  lowStockAlert: boolean;
  averageRating: number;
  reviewCount: number;
  status: ProductStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductCreationAttributes
  extends Optional<
    ProductAttributes,
    | 'id'
    | 'slug'
    | 'description'
    | 'brand'
    | 'gender'
    | 'categoryType'
    | 'categoryId'
    | 'subCategoryId'
    | 'discountPercent'
    | 'discountStartDate'
    | 'discountEndDate'
    | 'isActive'
    | 'inStock'
    | 'lowStockThreshold'
    | 'lowStockAlert'
    | 'averageRating'
    | 'reviewCount'
    | 'status'
  > {}

class Product extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes {
  declare id: string;
  declare storeId: string;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare brand: string | null;
  declare gender: StoreGender | null;
  declare categoryType: string | null;
  declare categoryId: string | null;
  declare subCategoryId: string | null;
  declare basePrice: number;
  declare discountPercent: number;
  declare discountStartDate: Date | null;
  declare discountEndDate: Date | null;
  declare isActive: boolean;
  declare inStock: boolean;
  declare lowStockThreshold: number;
  declare lowStockAlert: boolean;
  declare averageRating: number;
  declare reviewCount: number;
  declare status: ProductStatus;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  get finalPrice(): number {
    const raw = (this as any).dataValues || {};
    const base = Number(this.basePrice ?? raw.basePrice ?? raw.base_price ?? 0);
    const discount = Number(this.discountPercent ?? raw.discountPercent ?? raw.discount_percent ?? 0);

    const startDate = this.discountStartDate ?? raw.discountStartDate ?? raw.discount_start_date;
    const endDate = this.discountEndDate ?? raw.discountEndDate ?? raw.discount_end_date;
    const now = new Date();
    let isValid = true;
    if (startDate && new Date(startDate) > now) isValid = false;
    if (endDate && new Date(endDate) < now) isValid = false;

    const appliedDiscount = isValid ? discount : 0;
    return parseFloat((base * (1 - appliedDiscount / 100)).toFixed(2));
  }

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    const basePrice = Number(this.basePrice ?? raw.basePrice ?? raw.base_price ?? 0);
    const discountPercent = Number(this.discountPercent ?? raw.discountPercent ?? raw.discount_percent ?? 0);

    const startDate = this.discountStartDate ?? raw.discountStartDate ?? raw.discount_start_date;
    const endDate = this.discountEndDate ?? raw.discountEndDate ?? raw.discount_end_date;
    const now = new Date();
    let isValid = true;
    if (startDate && new Date(startDate) > now) isValid = false;
    if (endDate && new Date(endDate) < now) isValid = false;

    const appliedDiscount = isValid ? discountPercent : 0;
    const finalPrice = parseFloat((basePrice * (1 - appliedDiscount / 100)).toFixed(2));

    return {
      id: this.id || raw.id || '',
      storeId: this.storeId || raw.storeId || raw.store_id || '',
      name: this.name || raw.name || '',
      slug: this.slug || raw.slug || '',
      description: this.description || raw.description || null,
      brand: this.brand || raw.brand || null,
      gender: this.gender || raw.gender || null,
      categoryType: this.categoryType || raw.categoryType || raw.category_type || null,
      categoryId: this.categoryId || raw.categoryId || raw.category_id || null,
      subCategoryId: this.subCategoryId || raw.subCategoryId || raw.sub_category_id || null,
      basePrice,
      discountPercent,
      discountStartDate: startDate ? new Date(startDate).toISOString() : null,
      discountEndDate: endDate ? new Date(endDate).toISOString() : null,
      finalPrice,
      isActive: this.isActive ?? raw.isActive ?? raw.is_active ?? true,
      inStock: this.inStock ?? raw.inStock ?? raw.in_stock ?? true,
      lowStockThreshold: Number(this.lowStockThreshold ?? raw.lowStockThreshold ?? raw.low_stock_threshold ?? 10),
      lowStockAlert: this.lowStockAlert ?? raw.lowStockAlert ?? raw.low_stock_alert ?? false,
      averageRating: parseFloat(Number(this.averageRating ?? raw.averageRating ?? raw.average_rating ?? 0).toFixed(2)),
      reviewCount: Number(this.reviewCount ?? raw.reviewCount ?? raw.review_count ?? 0),
      status: (this.status ?? raw.status ?? 'draft') as ProductStatus,
      createdAt: (this.createdAt || raw.createdAt) ? new Date(this.createdAt || raw.createdAt).toISOString() : null,
      updatedAt: (this.updatedAt || raw.updatedAt) ? new Date(this.updatedAt || raw.updatedAt).toISOString() : null,
    };
  }
}

Product.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    slug: {
      type: DataTypes.STRING(300),
      allowNull: false,
      defaultValue: '',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    brand: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM('men', 'women', 'kids', 'unisex'),
      allowNull: true,
    },
    categoryType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'category_type',
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'category_id',
    },
    subCategoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'sub_category_id',
    },
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'base_price',
    },
    discountPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'discount_percent',
    },
    discountStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'discount_start_date',
    },
    discountEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'discount_end_date',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    inStock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'in_stock',
    },
    lowStockThreshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: 'low_stock_threshold',
    },
    lowStockAlert: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'low_stock_alert',
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'average_rating',
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'review_count',
    },
    status: {
      type: DataTypes.ENUM('draft', 'active'),
      allowNull: false,
      defaultValue: 'draft',
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
    tableName: 'products',
    underscored: false,
    indexes: [
      { fields: ['store_id'] },
      { fields: ['slug'], unique: true },
      { fields: ['brand'] },
      { fields: ['gender'] },
      { fields: ['category_type'] },
      { fields: ['category_id'] },
      { fields: ['sub_category_id'] },
      { fields: ['is_active'] },
      { fields: ['in_stock'] },
      { fields: ['status'] },
      { fields: ['store_id', 'status'] },
    ],
  },
);

export default Product;
