import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';
import User from '@modules/user/user.model';
import Store from '@modules/store/store.model';
import { VendorRoleUser } from '@modules/user/role-user.model';
import { normalizeTicketImageUrls } from './ticketImageUrls';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum TicketStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum TicketType {
  USER_TO_STORE = 'USER_TO_STORE',
  VENDOR_TO_ADMIN = 'VENDOR_TO_ADMIN',
}

// ─── Attribute interfaces ─────────────────────────────────────────────────────

export interface TicketAttributes {
  id: string;
  raisedById: string;
  storeId: string | null;
  description: string;
  imageUrl: string[] | null;
  status: TicketStatus;
  type: TicketType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TicketCreationAttributes
  extends Optional<TicketAttributes, 'id' | 'storeId' | 'imageUrl' | 'status'> {}

// ─── Model class ──────────────────────────────────────────────────────────────

class Ticket extends Model<TicketAttributes, TicketCreationAttributes> implements TicketAttributes {
  declare id: string;
  declare raisedById: string;
  declare storeId: string | null;
  declare description: string;
  declare imageUrl: string[] | null;
  declare status: TicketStatus;
  declare type: TicketType;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  toPublicJSON(): any {
    const raw = (this as any).dataValues || {};
    const rawImageUrl = this.imageUrl ?? raw.imageUrl ?? raw.image_url ?? null;

    return {
      id: this.id || raw.id || '',
      raisedById: this.raisedById || raw.raisedById || raw.raised_by_id || '',
      storeId: this.storeId ?? raw.storeId ?? raw.store_id ?? null,
      description: this.description || raw.description || '',
      imageUrl: normalizeTicketImageUrls(rawImageUrl),
      status: this.status || raw.status || 'PENDING',
      type: this.type || raw.type || '',
      createdAt: (this.createdAt || raw.createdAt)
        ? new Date(this.createdAt || raw.createdAt).toISOString()
        : '',
      updatedAt: (this.updatedAt || raw.updatedAt)
        ? new Date(this.updatedAt || raw.updatedAt).toISOString()
        : '',
    };
  }
}

Ticket.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    raisedById: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'raised_by_id',
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'store_id',
      references: { model: 'stores', key: 'id' },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'image_url',
      defaultValue: null,
      get() {
        return normalizeTicketImageUrls(this.getDataValue('imageUrl'));
      },
      set(value: unknown) {
        this.setDataValue('imageUrl', normalizeTicketImageUrls(value));
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TicketStatus)),
      allowNull: false,
      defaultValue: TicketStatus.PENDING,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(TicketType)),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'tickets',
    underscored: true,
    timestamps: true,
  },
);

// ─── Associations ─────────────────────────────────────────────────────────────

Ticket.belongsTo(User, { as: 'raisedByUser', foreignKey: 'raisedById', constraints: false });
Ticket.belongsTo(VendorRoleUser, { as: 'raisedByVendor', foreignKey: 'raisedById', constraints: false });
Ticket.belongsTo(Store, { as: 'store', foreignKey: 'storeId' });

export default Ticket;
