import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';
import type { Roles } from '@modules/user/user.model';
import type { NotificationType } from './notification.types';

export type NotificationCategory =
  | 'orders'
  | 'inventory'
  | 'payments'
  | 'wallet'
  | 'promotions'
  | 'account'
  | 'general';

export interface NotificationInboxAttributes {
  id: string;
  userId: string;
  role: Roles;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  data: Record<string, string>;
  isRead: boolean;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationInboxCreationAttributes
  extends Optional<
    NotificationInboxAttributes,
    'id' | 'data' | 'isRead' | 'readAt' | 'createdAt' | 'updatedAt'
  > {}

class NotificationInbox
  extends Model<NotificationInboxAttributes, NotificationInboxCreationAttributes>
  implements NotificationInboxAttributes
{
  declare id: string;
  declare userId: string;
  declare role: Roles;
  declare type: NotificationType;
  declare category: NotificationCategory;
  declare title: string;
  declare body: string;
  declare data: Record<string, string>;
  declare isRead: boolean;
  declare readAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON() {
    return {
      id: this.id,
      userId: this.userId,
      role: this.role,
      type: this.type,
      category: this.category,
      title: this.title,
      body: this.body,
      data: this.data ?? {},
      isRead: this.isRead,
      readAt: this.readAt?.toISOString?.() ?? null,
      createdAt: this.createdAt?.toISOString?.() ?? null,
      updatedAt: this.updatedAt?.toISOString?.() ?? null,
    };
  }
}

NotificationInbox.init(
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
    role: {
      type: DataTypes.ENUM('user', 'vendor', 'admin'),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM(
        'orders',
        'inventory',
        'payments',
        'wallet',
        'promotions',
        'account',
        'general',
      ),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_read',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at',
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    underscored: false,
    indexes: [
      { fields: ['user_id', 'role', 'createdAt'] },
      { fields: ['user_id', 'role', 'category'] },
      { fields: ['user_id', 'role', 'is_read'] },
    ],
  },
);

export default NotificationInbox;
