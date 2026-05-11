import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';
import Category from '@modules/category/category.model';

export interface SubCategoryAttributes {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubCategoryCreationAttributes
  extends Optional<SubCategoryAttributes, 'id' | 'description' | 'isActive'> {}

class SubCategory
  extends Model<SubCategoryAttributes, SubCategoryCreationAttributes>
  implements SubCategoryAttributes
{
  declare id: string;
  declare categoryId: string;
  declare name: string;
  declare description: string | null;
  declare isActive: boolean;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      categoryId: this.categoryId || raw.categoryId || raw.category_id || '',
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
  }
}

SubCategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'category_id',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
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
    tableName: 'sub_categories',
    underscored: false,
    indexes: [
      { fields: ['category_id'] },
      { fields: ['is_active'] },
      { fields: ['category_id', 'name'], unique: true },
    ],
  },
);

// FK association
SubCategory.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(SubCategory, { foreignKey: 'categoryId', as: 'subCategories' });

export default SubCategory;
