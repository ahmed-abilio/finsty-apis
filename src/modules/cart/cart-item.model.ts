import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface CartItemAttributes {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  isSelected: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CartItemCreationAttributes
  extends Optional<CartItemAttributes, 'id' | 'variantId' | 'quantity' | 'isSelected'> {}

class CartItem extends Model<CartItemAttributes, CartItemCreationAttributes>
  implements CartItemAttributes {
  declare id: string;
  declare cartId: string;
  declare productId: string;
  declare variantId: string | null;
  declare quantity: number;
  declare isSelected: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CartItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    cartId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'cart_id',
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id',
    },
    variantId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'variant_id',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    isSelected: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_selected',
    },
  },
  {
    sequelize,
    tableName: 'cart_items',
    underscored: false,
    indexes: [
      { fields: ['cart_id'] },
      { fields: ['product_id'] },
    ],
  },
);

export default CartItem;
