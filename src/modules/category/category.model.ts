import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface CategoryAttributes {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CategoryCreationAttributes
  extends Optional<CategoryAttributes, 'id' | 'description' | 'isActive'> {}

class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare isActive: boolean;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;

  declare public subCategories?: any[];

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    const result: any = {
      id: this.id || raw.id || '',
      name: this.name || raw.name || '',
      description: this.description ?? raw.description ?? null,
      isActive: this.isActive ?? raw.isActive ?? raw.is_active ?? true,
      createdAt:
        this.createdAt || raw.createdAt
          ? new Date(this.createdAt || raw.createdAt).toISOString()
          : null,
      updatedAt:
        this.updatedAt || raw.updatedAt
          ? new Date(this.updatedAt || raw.updatedAt).toISOString()
          : null,
    };

    if (this.subCategories) {
      result.subCategories = this.subCategories.map((sc: any) =>
        typeof sc.toPublicJSON === 'function' ? sc.toPublicJSON() : sc,
      );
    } else if (raw.subCategories) {
      result.subCategories = raw.subCategories.map((sc: any) =>
        typeof sc.toPublicJSON === 'function' ? sc.toPublicJSON() : sc,
      );
    }

    return result;
  }
}

Category.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
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
    tableName: 'categories',
    underscored: false,
    indexes: [
      { fields: ['name'], unique: true },
      { fields: ['is_active'] },
    ],
  },
);

export default Category;
