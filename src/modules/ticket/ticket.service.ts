import Ticket, { TicketType, TicketStatus } from './ticket.model';
import Store from '@modules/store/store.model';
import User from '@modules/user/user.model';
import { VendorRoleUser } from '@modules/user/role-user.model';
import { AppError } from '@utils/appError';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateTicketInput {
  storeId?: string;
  description: string;
  imageUrl?: string;
  type: TicketType;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface AdminTicketQuery extends PaginationQuery {
  status?: TicketStatus;
}

export interface PaginatedTickets {
  items: object[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Response Formatter Helper ───────────────────────────────────────────────

function formatTicketResponse(t: Ticket) {
  const raisedBy = t.type === TicketType.USER_TO_STORE
    ? ((t as any).raisedByUser
      ? {
          id: (t as any).raisedByUser.id,
          name: (t as any).raisedByUser.name ?? null,
          phone: (t as any).raisedByUser.phone ?? null,
          profileImage: (t as any).raisedByUser.profileImage ?? null,
          email: null,
        }
      : null)
    : ((t as any).raisedByVendor
      ? {
          id: (t as any).raisedByVendor.id,
          name: (t as any).raisedByVendor.name ?? null,
          phone: (t as any).raisedByVendor.phone ?? null,
          email: (t as any).raisedByVendor.email ?? null,
          profileImage: (t as any).raisedByVendor.profileImage ?? null,
        }
      : null);

  const store = (t as any).store
    ? {
        id: (t as any).store.id,
        name: (t as any).store.name,
        logoUrl: (t as any).store.logoUrl ?? null,
      }
    : null;

  return {
    ...t.toPublicJSON(),
    raisedBy,
    store,
  };
}

const defaultIncludes = [
  { model: Store, as: 'store', attributes: ['id', 'name', 'logoUrl'] },
  { model: User, as: 'raisedByUser', attributes: ['id', 'name', 'phone', 'profileImage'] },
  { model: VendorRoleUser, as: 'raisedByVendor', attributes: ['id', 'name', 'phone', 'email', 'profileImage'] },
];

class TicketService {
  // ── Create a ticket ─────────────────────────────────────────────────────────

  async createTicket(raisedById: string, input: CreateTicketInput) {
    // If USER_TO_STORE, validate the store exists
    if (input.type === TicketType.USER_TO_STORE) {
      if (!input.storeId) {
        throw AppError.badRequest('storeId is required for user tickets', 'STORE_ID_REQUIRED');
      }
      const store = await Store.findByPk(input.storeId);
      if (!store) {
        throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
      }
    }

    const ticket = await Ticket.create({
      raisedById,
      storeId: input.type === TicketType.USER_TO_STORE ? input.storeId! : null,
      description: input.description,
      imageUrl: input.imageUrl ?? null,
      type: input.type,
    });

    const refetched = await Ticket.findByPk(ticket.id, {
      include: defaultIncludes,
    });

    if (!refetched) {
      return ticket.toPublicJSON();
    }

    return formatTicketResponse(refetched);
  }

  // ── Get tickets raised by the current user/vendor ───────────────────────────

  async getUserTickets(userId: string, query: PaginationQuery): Promise<PaginatedTickets> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await Ticket.findAndCountAll({
      where: { raisedById: userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: defaultIncludes,
    });

    return {
      items: rows.map((t) => formatTicketResponse(t)),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ── Get tickets raised to the vendor's store ────────────────────────────────

  async getStoreTickets(vendorUserId: string, query: PaginationQuery): Promise<PaginatedTickets> {
    // Find stores owned by this vendor
    const stores = await Store.findAll({ where: { ownerId: vendorUserId }, attributes: ['id'] });
    const storeIds = stores.map((s) => s.id);

    if (storeIds.length === 0) {
      return { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await Ticket.findAndCountAll({
      where: {
        storeId: storeIds,
        type: TicketType.USER_TO_STORE,
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: defaultIncludes,
    });

    return {
      items: rows.map((t) => formatTicketResponse(t)),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ── Get all vendor-to-admin tickets (admin only) ────────────────────────────

  async getAdminTickets(query: AdminTicketQuery): Promise<PaginatedTickets> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: any = { type: TicketType.VENDOR_TO_ADMIN };
    if (query.status) where.status = query.status;

    const { count, rows } = await Ticket.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: defaultIncludes,
    });

    return {
      items: rows.map((t) => formatTicketResponse(t)),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ── Update ticket status ────────────────────────────────────────────────────

  async updateTicketStatus(ticketId: string, status: TicketStatus, callerUserId: string, callerRole: string) {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) throw AppError.notFound('Ticket not found', 'TICKET_NOT_FOUND');

    // Authorization: admin can update VENDOR_TO_ADMIN tickets; vendor can update USER_TO_STORE tickets for their store
    if (callerRole === 'admin') {
      if (ticket.type !== TicketType.VENDOR_TO_ADMIN) {
        throw AppError.forbidden('Admins can only update vendor-to-admin tickets', 'FORBIDDEN');
      }
    } else if (callerRole === 'vendor') {
      if (ticket.type !== TicketType.USER_TO_STORE) {
        throw AppError.forbidden('Vendors can only update user-to-store tickets', 'FORBIDDEN');
      }
      // Verify the ticket belongs to the vendor's store
      const store = await Store.findOne({ where: { id: ticket.storeId!, ownerId: callerUserId } });
      if (!store) {
        throw AppError.forbidden('This ticket does not belong to your store', 'FORBIDDEN');
      }
    } else {
      throw AppError.forbidden('You do not have permission to update this ticket', 'FORBIDDEN');
    }

    await ticket.update({ status });

    const refetched = await Ticket.findByPk(ticket.id, {
      include: defaultIncludes,
    });

    if (!refetched) {
      return ticket.toPublicJSON();
    }

    return formatTicketResponse(refetched);
  }
}

export default new TicketService();
