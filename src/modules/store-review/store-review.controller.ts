import { FastifyRequest, FastifyReply } from 'fastify';
import storeReviewService from './store-review.service';
import type { SubmitStoreReviewInput, ListStoreReviewsInput } from './store-review.service';
import { Roles } from '@modules/user/user.model';

// ─── Param / query interfaces ─────────────────────────────────────────────────

interface StoreParams {
  storeId: string;
}

interface StoreReviewParams {
  storeId: string;
  reviewId: string;
}

interface AdminReviewParams {
  reviewId: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class StoreReviewController {
  // ── User: submit review ────────────────────────────────────────────────────

  async submit(
    request: FastifyRequest<{ Params: StoreParams; Body: SubmitStoreReviewInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const review = await storeReviewService.submit(
      request.params.storeId,
      request.user.sub,
      request.body,
    );
    void reply.status(201).send({ success: true, data: { review } });
  }

  // ── Public: list approved reviews for a store ──────────────────────────────

  async listForStore(
    request: FastifyRequest<{ Params: StoreParams; Querystring: PaginationQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await storeReviewService.listForStore(
      request.params.storeId,
      request.query.page,
      request.query.limit,
    );
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

  // ── Vendor / Admin: reply to a review ─────────────────────────────────────

  async respond(
    request: FastifyRequest<{ Params: StoreReviewParams; Body: { response: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const isAdmin = request.user.role === Roles.ADMIN;
    const review = await storeReviewService.respond(
      request.params.storeId,
      request.params.reviewId,
      request.user.sub,
      isAdmin,
      request.body.response,
    );
    void reply.status(200).send({ success: true, data: { review } });
  }

  // ── Admin: list all store reviews ─────────────────────────────────────────

  async adminList(
    request: FastifyRequest<{ Querystring: ListStoreReviewsInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await storeReviewService.adminList(request.query);
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

  // ── Admin: toggle isApproved ───────────────────────────────────────────────

  async setStatus(
    request: FastifyRequest<{ Params: AdminReviewParams; Body: { isApproved: boolean } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const review = await storeReviewService.setStatus(
      request.params.reviewId,
      request.body.isApproved,
    );
    void reply.status(200).send({ success: true, data: { review } });
  }
}

export default new StoreReviewController();
