import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Attribute interfaces ──────────────────────────────────────────────────────

export interface ProductVariantImageAttributes {
  id: string;
  variantId: string;
  imageUrl: string;
  altText: string | null;
  displayOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVariantImageCreationAttributes
  extends Optional<ProductVariantImageAttributes, 'id' | 'altText' | 'displayOrder'> {}

// ─── Model class ──────────────────────────────────────────────────────────────

class ProductVariantImage
  extends Model<ProductVariantImageAttributes, ProductVariantImageCreationAttributes>
  implements ProductVariantImageAttributes
{
  declare id: string;
  declare variantId: string;
  declare imageUrl: string;
  declare altText: string | null;
  declare displayOrder: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      variantId: this.variantId || raw.variantId || raw.variant_id || '',
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

ProductVariantImage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    variantId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'variant_id',
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
    tableName: 'product_variant_images',
    underscored: false,
    indexes: [{ fields: ['variant_id'] }],
  },
);

export default ProductVariantImage;
