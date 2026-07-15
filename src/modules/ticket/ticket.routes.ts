import { FastifyInstance } from 'fastify';
import ticketController from './ticket.controller';
import {
  createTicketSchema,
  getMyTicketsSchema,
  getStoreTicketsSchema,
  getAdminTicketsSchema,
  updateTicketStatusSchema,
} from './ticket.schema';
import { Roles } from '@modules/user/user.model';

export default async function ticketRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST / — Raise a ticket (user → store, or vendor → admin) ─────────────
  fastify.post(
    '/',
    {
      schema: createTicketSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => ticketController.create(request as any, reply),
  );

  // ── GET /raised — My raised tickets ───────────────────────────────────────
  fastify.get(
    '/raised',
    {
      schema: getMyTicketsSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => ticketController.listMyTickets(request as any, reply),
  );

  // ── GET /store — Tickets raised to the vendor's store (vendor-only) ───────
  fastify.get(
    '/store',
    {
      schema: getStoreTicketsSchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.VENDOR)],
    },
    (request, reply) => ticketController.listStoreTickets(request as any, reply),
  );

  // ── GET /admin — All vendor-to-admin tickets (admin-only) ─────────────────
  fastify.get(
    '/admin',
    {
      schema: getAdminTicketsSchema,
      preHandler: [fastify.authenticate, fastify.requireRole(Roles.ADMIN)],
    },
    (request, reply) => ticketController.listAdminTickets(request as any, reply),
  );

  // ── PATCH /:ticketId/status — Update ticket status (vendor or admin) ──────
  fastify.patch(
    '/:ticketId/status',
    {
      schema: updateTicketStatusSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => ticketController.updateStatus(request as any, reply),
  );
}
