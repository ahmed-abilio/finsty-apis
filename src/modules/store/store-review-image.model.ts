import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Attribute interfaces ──────────────────────────────────────────────────────

export interface StoreReviewImageAttributes {
  id: string;
  reviewId: string;
  imageUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoreReviewImageCreationAttributes
  extends Optional<StoreReviewImageAttributes, 'id'> {}

// ─── Model class ──────────────────────────────────────────────────────────────

class StoreReviewImage
  extends Model<StoreReviewImageAttributes, StoreReviewImageCreationAttributes>
  implements StoreReviewImageAttributes
{
  declare id: string;
  declare reviewId: string;
  declare imageUrl: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      reviewId: this.reviewId || raw.reviewId || raw.review_id || '',
      imageUrl: this.imageUrl || raw.imageUrl || raw.image_url || '',
      createdAt: (this.createdAt || raw.createdAt)
        ? new Date(this.createdAt || raw.createdAt).toISOString()
        : null,
      updatedAt: (this.updatedAt || raw.updatedAt)
        ? new Date(this.updatedAt || raw.updatedAt).toISOString()
        : null,
    };
  }
}

StoreReviewImage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    reviewId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'review_id',
    },
    imageUrl: {
      type: DataTypes.STRING(2048),
      allowNull: false,
      field: 'image_url',
    },
    createdAt: { type: DataTypes.DATE, allowNull: true },
    updatedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'store_review_images',
    underscored: false,
    indexes: [{ fields: ['review_id'] }],
  },
);

export default StoreReviewImage;
