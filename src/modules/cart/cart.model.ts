import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface CartAttributes {
  id: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CartCreationAttributes extends Optional<CartAttributes, 'id'> {}

class Cart extends Model<CartAttributes, CartCreationAttributes> implements CartAttributes {
  declare id: string;
  declare userId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Cart.init(
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
      unique: true,
      field: 'user_id',
    },
  },
  {
    sequelize,
    tableName: 'carts',
    underscored: false,
    indexes: [{ fields: ['user_id'], unique: true }],
  },
);

export default Cart;
