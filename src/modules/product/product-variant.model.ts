import { DataTypes, Model, Optional, Op, WhereOptions } from 'sequelize';

import sequelize from '@config/database';

export interface ProductVariantAttributes {
  id: string;
  productId: string;
  colorId: string;
  size: string | null;
  sizeChart: string | null;
  sku: string | null;
  stock: number;
  additionalPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVariantCreationAttributes
  extends Optional<
    ProductVariantAttributes,
    'id' | 'size' | 'sizeChart' | 'sku' | 'stock' | 'additionalPrice'
  > {}

class ProductVariant extends Model<ProductVariantAttributes, ProductVariantCreationAttributes>
  implements ProductVariantAttributes {
  declare id: string;
  declare productId: string;
  declare colorId: string;
  declare size: string | null;
  declare sizeChart: string | null;
  declare sku: string | null;
  declare stock: number;
  declare additionalPrice: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  get label(): string {
    return this.size ? `Size: ${this.size}` : 'Default';
  }

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      productId: this.productId || raw.productId || raw.product_id || '',
      colorId: this.colorId || raw.colorId || raw.color_id || '',
      size: this.size || raw.size || null,
      sizeChart: this.sizeChart || raw.sizeChart || raw.size_chart || null,
      sku: this.sku || raw.sku || null,
      stock: Number(this.stock ?? raw.stock ?? 0),
      additionalPrice: Number(this.additionalPrice ?? raw.additionalPrice ?? raw.additional_price ?? 0),
      label: this.label,
      createdAt: (this.createdAt || raw.createdAt) ? new Date(this.createdAt || raw.createdAt).toISOString() : null,
      updatedAt: (this.updatedAt || raw.updatedAt) ? new Date(this.updatedAt || raw.updatedAt).toISOString() : null,
    };
  }
}

ProductVariant.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id',
    },
    colorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'color_id',
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    sizeChart: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'size_chart',
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    additionalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'additional_price',
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
    tableName: 'product_variants',
    underscored: false,
    indexes: [
      { fields: ['product_id'] },
      { fields: ['color_id'] },
      // Unique per product — prevents duplicate SKUs within the same product.
      // The `where` clause excludes NULLs so variants without SKUs are always allowed.
      {
        fields: ['product_id', 'sku'],
        unique: true,
        where: { sku: { [Op.ne]: null } } as WhereOptions,
      },
    ],
  },
);

export default ProductVariant;
