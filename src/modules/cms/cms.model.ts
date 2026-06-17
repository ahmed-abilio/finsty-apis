import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';
import type { CmsAudienceType } from './cms.types';

export interface CmsPageAttributes {
  id: string;
  slug: string;
  title: string;
  audienceType: CmsAudienceType;
  contentHtml: string;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CmsPageCreationAttributes
  extends Optional<CmsPageAttributes, 'id' | 'isPublished' | 'createdAt' | 'updatedAt'> {}

class CmsPage
  extends Model<CmsPageAttributes, CmsPageCreationAttributes>
  implements CmsPageAttributes
{
  declare id: string;
  declare slug: string;
  declare title: string;
  declare audienceType: CmsAudienceType;
  declare contentHtml: string;
  declare isPublished: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON() {
    return {
      id: this.id,
      slug: this.slug,
      title: this.title,
      audienceType: this.audienceType,
      contentHtml: this.contentHtml,
      isPublished: this.isPublished,
      createdAt: this.createdAt?.toISOString?.() ?? this.createdAt,
      updatedAt: this.updatedAt?.toISOString?.() ?? this.updatedAt,
    };
  }
}

CmsPage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    audienceType: {
      type: DataTypes.ENUM('user', 'vendor', 'admin', 'all'),
      allowNull: false,
      field: 'audience_type',
    },
    contentHtml: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'content_html',
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_published',
    },
  },
  {
    sequelize,
    tableName: 'cms_pages',
    indexes: [
      { unique: true, fields: ['slug', 'audience_type'] },
      { fields: ['audience_type'] },
      { fields: ['slug'] },
    ],
  },
);

export default CmsPage;
