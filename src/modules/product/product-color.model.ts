import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Attribute interfaces ──────────────────────────────────────────────────────

export interface ProductColorAttributes {
  id: string;
  productId: string;
  colorName: string | null;
  colorHex: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductColorCreationAttributes
  extends Optional<ProductColorAttributes, 'id' | 'colorName' | 'colorHex'> {}

// ─── Model class ──────────────────────────────────────────────────────────────

class ProductColor
  extends Model<ProductColorAttributes, ProductColorCreationAttributes>
  implements ProductColorAttributes
{
  declare id: string;
  declare productId: string;
  declare colorName: string | null;
  declare colorHex: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      productId: this.productId || raw.productId || raw.product_id || '',
      colorName: this.colorName || raw.colorName || raw.color_name || '',
      colorHex: this.colorHex ?? raw.colorHex ?? raw.color_hex ?? null,
      createdAt: (this.createdAt || raw.createdAt)
        ? new Date(this.createdAt || raw.createdAt).toISOString()
        : null,
      updatedAt: (this.updatedAt || raw.updatedAt)
        ? new Date(this.updatedAt || raw.updatedAt).toISOString()
        : null,
    };
  }
}

ProductColor.init(
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
    colorName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'color_name',
    },
    colorHex: {
      type: DataTypes.STRING(7),
      allowNull: true,
      field: 'color_hex',
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
    tableName: 'product_colors',
    underscored: false,
    indexes: [{ fields: ['product_id'] }],
  },
);

export default ProductColor;
