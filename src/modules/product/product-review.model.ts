import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Attribute interfaces ──────────────────────────────────────────────────────

export interface ProductReviewAttributes {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment: string | null;
  response: string | null;
  isApproved: boolean;
  isFlagged: boolean;
  flagReason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductReviewCreationAttributes
  extends Optional<
    ProductReviewAttributes,
    'id' | 'comment' | 'response' | 'isApproved' | 'isFlagged' | 'flagReason'
  > {}

// ─── Model class ──────────────────────────────────────────────────────────────

class ProductReview
  extends Model<ProductReviewAttributes, ProductReviewCreationAttributes>
  implements ProductReviewAttributes
{
  declare id: string;
  declare productId: string;
  declare userId: string;
  declare rating: number;
  declare comment: string | null;
  declare response: string | null;
  declare isApproved: boolean;
  declare isFlagged: boolean;
  declare flagReason: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    return {
      id: this.id || raw.id || '',
      productId: this.productId || raw.productId || raw.product_id || '',
      userId: this.userId || raw.userId || raw.user_id || '',
      rating: Number(this.rating ?? raw.rating ?? 0),
      comment: this.comment ?? raw.comment ?? null,
      response: this.response ?? raw.response ?? null,
      isApproved: this.isApproved ?? raw.isApproved ?? raw.is_approved ?? true,
      isFlagged: this.isFlagged ?? raw.isFlagged ?? raw.is_flagged ?? false,
      flagReason: this.flagReason ?? raw.flagReason ?? raw.flag_reason ?? null,
      createdAt: (this.createdAt || raw.createdAt)
        ? new Date(this.createdAt || raw.createdAt).toISOString()
        : null,
      updatedAt: (this.updatedAt || raw.updatedAt)
        ? new Date(this.updatedAt || raw.updatedAt).toISOString()
        : null,
    };
  }
}

ProductReview.init(
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_approved',
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_flagged',
    },
    flagReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'flag_reason',
    },
    createdAt: { type: DataTypes.DATE, allowNull: true },
    updatedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'product_reviews',
    underscored: false,
    indexes: [
      { fields: ['product_id'] },
      { fields: ['user_id'] },
      { fields: ['is_approved'] },
      { fields: ['is_flagged'] },
      // One review per user per product
      { fields: ['product_id', 'user_id'], unique: true },
    ],
  },
);

export default ProductReview;
