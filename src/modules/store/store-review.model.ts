import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

// ─── Attribute interfaces ──────────────────────────────────────────────────────

export interface StoreReviewAttributes {
  id: string;
  storeId: string;
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

export interface StoreReviewCreationAttributes
  extends Optional<
    StoreReviewAttributes,
    'id' | 'comment' | 'response' | 'isApproved' | 'isFlagged' | 'flagReason'
  > {}

// ─── Model class ──────────────────────────────────────────────────────────────

class StoreReview
  extends Model<StoreReviewAttributes, StoreReviewCreationAttributes>
  implements StoreReviewAttributes
{
  declare id: string;
  declare storeId: string;
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
      storeId: this.storeId || raw.storeId || raw.store_id || '',
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

StoreReview.init(
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
    tableName: 'store_reviews',
    underscored: false,
    indexes: [
      { fields: ['store_id'] },
      { fields: ['user_id'] },
      { fields: ['is_approved'] },
      { fields: ['is_flagged'] },
      { fields: ['store_id', 'user_id'], unique: true },
    ],
  },
);

export default StoreReview;
