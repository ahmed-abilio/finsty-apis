import { fn, col } from 'sequelize';
import sequelize from '@config/database';
import Store from '@modules/store/store.model';
import StoreReview from '@modules/store/store-review.model';
import StoreReviewImage from '@modules/store/store-review-image.model';
import User from '@modules/user/user.model';
import { AppError } from '@utils/appError';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface SubmitStoreReviewInput {
  rating: number;
  comment?: string;
  images?: string[];   // array of S3 URLs (max 5)
}

export interface ListStoreReviewsInput {
  storeId?: string;
  isFlagged?: boolean;
  isApproved?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedStoreReviews {
  items: object[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Aggregate helper ─────────────────────────────────────────────────────────

async function recalculateStoreRating(storeId: string): Promise<void> {
  const result = await StoreReview.findOne({
    where: { storeId, isApproved: true },
    attributes: [
      [fn('COUNT', col('id')), 'count'],
      [fn('AVG', col('rating')), 'avg'],
    ],
    raw: true,
  }) as any;

  const totalRatings = Number(result?.count ?? 0);
  const rating = totalRatings > 0
    ? parseFloat(Number(result?.avg ?? 0).toFixed(2))
    : 0;

  await Store.update({ rating, totalRatings }, { where: { id: storeId } });
}

// ─── Service ──────────────────────────────────────────────────────────────────

class StoreReviewService {
  // ── User: Submit review ────────────────────────────────────────────────────

  async submit(storeId: string, userId: string, input: SubmitStoreReviewInput) {
    const store = await Store.findByPk(storeId);
    if (!store || !store.isActive) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');

    const existing = await StoreReview.findOne({ where: { storeId, userId } });
    if (existing) {
      throw AppError.conflict('You have already reviewed this store', 'REVIEW_EXISTS');
    }

    if (input.rating < 1 || input.rating > 5) {
      throw AppError.badRequest('Rating must be between 1 and 5', 'INVALID_RATING');
    }

    return sequelize.transaction(async (t) => {
      const review = await StoreReview.create(
        {
          storeId,
          userId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
        { transaction: t },
      );

      const reviewImages: StoreReviewImage[] = [];
      if (input.images?.length) {
        const created = await StoreReviewImage.bulkCreate(
          input.images.map((url) => ({ reviewId: review.id, imageUrl: url })),
          { transaction: t },
        );
        reviewImages.push(...created);
      }

      await recalculateStoreRating(storeId);

      return {
        ...review.toPublicJSON(),
        images: reviewImages.map((img) => img.toPublicJSON()),
      };
    });
  }

  // ── Public: List approved reviews for a store ──────────────────────────────

  async listForStore(storeId: string, page = 1, limit = 20): Promise<PaginatedStoreReviews> {
    const store = await Store.findByPk(storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');

    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));
    const offset = (page - 1) * limit;

    const { count, rows } = await StoreReview.findAndCountAll({
      where: { storeId, isApproved: true },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: StoreReviewImage, as: 'images' },
        { model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] },
      ],
    });

    return {
      items: rows.map((r) => ({
        ...r.toPublicJSON(),
        images: ((r as any).images as StoreReviewImage[] ?? []).map((img) => img.toPublicJSON()),
        user: (r as any).user
          ? {
              id: (r as any).user.id,
              name: (r as any).user.name ?? null,
              profileImage: (r as any).user.profileImage ?? null,
            }
          : null,
      })),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ── Admin: List all store reviews with optional filters ────────────────────

  async adminList(input: ListStoreReviewsInput): Promise<PaginatedStoreReviews> {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: any = {};
    if (input.storeId) where.storeId = input.storeId;
    if (input.isFlagged !== undefined) where.isFlagged = input.isFlagged;
    if (input.isApproved !== undefined) where.isApproved = input.isApproved;

    const { count, rows } = await StoreReview.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: StoreReviewImage, as: 'images' },
        { model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] },
        { model: Store, as: 'store', attributes: ['id', 'name'] },
      ],
    });

    return {
      items: rows.map((r) => ({
        ...r.toPublicJSON(),
        images: ((r as any).images as StoreReviewImage[] ?? []).map((img) => img.toPublicJSON()),
        user: (r as any).user
          ? { id: (r as any).user.id, name: (r as any).user.name ?? null }
          : null,
        store: (r as any).store
          ? { id: (r as any).store.id, name: (r as any).store.name }
          : null,
      })),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ── Vendor / Admin: Reply to a review ─────────────────────────────────────

  async respond(
    storeId: string,
    reviewId: string,
    requesterId: string,
    isAdmin: boolean,
    response: string,
  ) {
    const store = await Store.findByPk(storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');

    if (!isAdmin && store.ownerId !== requesterId) {
      throw AppError.forbidden('Only the store owner can respond to reviews', 'STORE_ACCESS_DENIED');
    }

    const review = await StoreReview.findOne({ where: { id: reviewId, storeId } });
    if (!review) throw AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');

    await review.update({ response });
    return review.toPublicJSON();
  }

  // ── Admin: Toggle isApproved (show / hide review) ─────────────────────────

  async setStatus(reviewId: string, isApproved: boolean) {
    const review = await StoreReview.findByPk(reviewId);
    if (!review) throw AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');

    const storeId = review.storeId;
    await review.update({ isApproved });
    await recalculateStoreRating(storeId);

    return review.toPublicJSON();
  }
}

export default new StoreReviewService();
