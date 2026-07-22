import { FastifyRequest, FastifyReply } from 'fastify';
import ticketService from './ticket.service';
import type { PaginationQuery, AdminTicketQuery } from './ticket.service';
import { TicketType, TicketStatus } from './ticket.model';
import { Roles } from '@modules/user/user.model';
import { AppError } from '@utils/appError';

// ─── Request interfaces ──────────────────────────────────────────────────────

interface CreateTicketBody {
  storeId?: string;
  description: string;
  imageUrl?: string[];
}

interface TicketParams {
  ticketId: string;
}

interface UpdateStatusBody {
  status: TicketStatus;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class TicketController {
  // ── Create ticket ───────────────────────────────────────────────────────────

  async create(
    request: FastifyRequest<{ Body: CreateTicketBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const role = request.user.role as Roles;
    const userId = request.user.sub;

    let type: TicketType;
    if (role === Roles.VENDOR) {
      type = TicketType.VENDOR_TO_ADMIN;
    } else if (role === Roles.USER) {
      if (!request.body.storeId) {
        throw AppError.badRequest('storeId is required for user tickets', 'STORE_ID_REQUIRED');
      }
      type = TicketType.USER_TO_STORE;
    } else {
      throw AppError.forbidden('Admins cannot raise tickets', 'FORBIDDEN');
    }

    const ticket = await ticketService.createTicket(userId, {
      storeId: request.body.storeId,
      description: request.body.description,
      imageUrl: request.body.imageUrl,
      type,
    });

    void reply.status(201).send({ success: true, data: { ticket } });
  }

  // ── List tickets raised by the current user/vendor ──────────────────────────

  async listMyTickets(
    request: FastifyRequest<{ Querystring: PaginationQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await ticketService.getUserTickets(request.user.sub, request.query);
    void reply.status(200).send({
      success: true,
      data: {
        items: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  // ── List tickets raised to the vendor's store ───────────────────────────────

  async listStoreTickets(
    request: FastifyRequest<{ Querystring: PaginationQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await ticketService.getStoreTickets(request.user.sub, request.query);
    void reply.status(200).send({
      success: true,
      data: {
        items: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  // ── List all vendor-to-admin tickets (admin) ────────────────────────────────

  async listAdminTickets(
    request: FastifyRequest<{ Querystring: AdminTicketQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await ticketService.getAdminTickets(request.query);
    void reply.status(200).send({
      success: true,
      data: {
        items: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  // ── Update ticket status ────────────────────────────────────────────────────

  async updateStatus(
    request: FastifyRequest<{ Params: TicketParams; Body: UpdateStatusBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const ticket = await ticketService.updateTicketStatus(
      request.params.ticketId,
      request.body.status,
      request.user.sub,
      request.user.role,
    );
    void reply.status(200).send({ success: true, data: { ticket } });
  }
}

export default new TicketController();
