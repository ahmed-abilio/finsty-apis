import { FastifyRequest, FastifyReply } from 'fastify';
import reviewService from './review.service';
import type { SubmitReviewInput, ListReviewsInput } from './review.service';

// ─── Param / query interfaces ─────────────────────────────────────────────────

interface ProductParams {
  productId: string;
}

interface ReviewParams {
  reviewId: string;
}

interface ProductReviewQuery {
  page?: number;
  limit?: number;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class ReviewController {
  // ── User: submit review ────────────────────────────────────────────────────

  async submit(
    request: FastifyRequest<{ Params: ProductParams; Body: SubmitReviewInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const review = await reviewService.submit(
      request.params.productId,
      request.user.sub,
      request.body,
    );
    void reply.status(201).send({ success: true, data: { review } });
  }

  // ── Public: list approved reviews for a product ────────────────────────────

  async listForProduct(
    request: FastifyRequest<{ Params: ProductParams; Querystring: ProductReviewQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await reviewService.listForProduct(
      request.params.productId,
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

  // ── Auth: flag a review ────────────────────────────────────────────────────

  async flag(
    request: FastifyRequest<{ Params: ReviewParams; Body: { reason?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const review = await reviewService.flag(
      request.params.reviewId,
      request.user.sub,
      request.body.reason,
    );
    void reply.status(200).send({ success: true, data: { review } });
  }

  // ── Admin: list all reviews ────────────────────────────────────────────────

  async adminList(
    request: FastifyRequest<{ Querystring: ListReviewsInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await reviewService.adminList(request.query);
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

  // ── Admin: respond to a review ─────────────────────────────────────────────

  async respond(
    request: FastifyRequest<{ Params: ReviewParams; Body: { response: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const review = await reviewService.respond(
      request.params.reviewId,
      request.body.response,
    );
    void reply.status(200).send({ success: true, data: { review } });
  }

  // ── Admin: toggle isApproved ───────────────────────────────────────────────

  async setStatus(
    request: FastifyRequest<{ Params: ReviewParams; Body: { isApproved: boolean } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const review = await reviewService.setStatus(
      request.params.reviewId,
      request.body.isApproved,
    );
    void reply.status(200).send({ success: true, data: { review } });
  }
}

export default new ReviewController();
