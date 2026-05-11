import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Attribute interfaces ──────────────────────────────────────────────────────

export interface ProductColorImageAttributes {
  id: string;
  colorId: string;
  imageUrl: string;
  altText: string | null;
  displayOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductColorImageCreationAttributes
  extends Optional<ProductColorImageAttributes, 'id' | 'altText' | 'displayOrder'> {}

// ─── Model class ──────────────────────────────────────────────────────────────

class ProductColorImage
  extends Model<ProductColorImageAttributes, ProductColorImageCreationAttributes>
  implements ProductColorImageAttributes
{
  declare id: string;
  declare colorId: string;
  declare imageUrl: string;
  declare altText: string | null;
  declare displayOrder: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      colorId: this.colorId || raw.colorId || raw.color_id || '',
      imageUrl: this.imageUrl || raw.imageUrl || raw.image_url || '',
      altText: this.altText ?? raw.altText ?? raw.alt_text ?? null,
      displayOrder: Number(this.displayOrder ?? raw.displayOrder ?? raw.display_order ?? 0),
      createdAt: (this.createdAt || raw.createdAt)
        ? new Date(this.createdAt || raw.createdAt).toISOString()
        : null,
      updatedAt: (this.updatedAt || raw.updatedAt)
        ? new Date(this.updatedAt || raw.updatedAt).toISOString()
        : null,
    };
  }
}

ProductColorImage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    colorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'color_id',
    },
    imageUrl: {
      type: DataTypes.STRING(2048),
      allowNull: false,
      field: 'image_url',
    },
    altText: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'alt_text',
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'display_order',
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
    tableName: 'product_color_images',
    underscored: false,
    indexes: [{ fields: ['color_id'] }],
  },
);

export default ProductColorImage;
