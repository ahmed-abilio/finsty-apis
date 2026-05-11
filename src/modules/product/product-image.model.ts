import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface ProductImageAttributes {
  id: string;
  productId: string;
  url: string;
  position: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductImageCreationAttributes
  extends Optional<ProductImageAttributes, 'id' | 'position'> {}

class ProductImage extends Model<ProductImageAttributes, ProductImageCreationAttributes>
  implements ProductImageAttributes {
  declare id: string;
  declare productId: string;
  declare url: string;
  declare position: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      productId: this.productId || raw.productId || raw.product_id || '',
      url: this.url || raw.url || '',
      position: Number(this.position ?? raw.position ?? 0),
      createdAt: (this.createdAt || raw.createdAt) ? new Date(this.createdAt || raw.createdAt).toISOString() : null,
      updatedAt: (this.updatedAt || raw.updatedAt) ? new Date(this.updatedAt || raw.updatedAt).toISOString() : null,
    };
  }
}

ProductImage.init(
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
    url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: 'product_images',
    underscored: false,
    indexes: [{ fields: ['product_id'] }],
  },
);

export default ProductImage;
