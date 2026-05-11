import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export interface BrandAttributes {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BrandCreationAttributes
  extends Optional<BrandAttributes, 'id' | 'slug' | 'logoUrl' | 'isActive'> {}

class Brand
  extends Model<BrandAttributes, BrandCreationAttributes>
  implements BrandAttributes
{
  declare id: string;
  declare storeId: string;
  declare name: string;
  declare slug: string;
  declare logoUrl: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      storeId: this.storeId || raw.storeId || raw.store_id || '',
      name: this.name || raw.name || '',
      slug: this.slug || raw.slug || '',
      logoUrl: this.logoUrl ?? raw.logoUrl ?? raw.logo_url ?? null,
      isActive: this.isActive ?? raw.isActive ?? raw.is_active ?? true,
      createdAt: (this.createdAt || raw.createdAt)
        ? new Date(this.createdAt || raw.createdAt).toISOString()
        : null,
      updatedAt: (this.updatedAt || raw.updatedAt)
        ? new Date(this.updatedAt || raw.updatedAt).toISOString()
        : null,
    };
  }
}

Brand.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'store_id',
      references: { model: 'stores', key: 'id' },
      onDelete: 'CASCADE',
    } as any,
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(300),
      allowNull: false,
      defaultValue: '',
    },
    logoUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'logo_url',
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
    tableName: 'brands',
    underscored: false,
    indexes: [
      { fields: ['name', 'storeId'], unique: true },
      { fields: ['slug', 'storeId'], unique: true },
      { fields: ['isActive'] },
      { fields: ['storeId'] },
    ],
  },
);

export default Brand;
