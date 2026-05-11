import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface WishlistAttributes {
  id: string;
  userId: string;
  productId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WishlistCreationAttributes extends Optional<WishlistAttributes, 'id'> {}

class Wishlist extends Model<WishlistAttributes, WishlistCreationAttributes>
  implements WishlistAttributes {
  declare id: string;
  declare userId: string;
  declare productId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Wishlist.init(
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
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id',
    },
  },
  {
    sequelize,
    tableName: 'wishlists',
    underscored: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['product_id'] },
      { fields: ['user_id', 'product_id'], unique: true },
    ],
  },
);

export default Wishlist;
