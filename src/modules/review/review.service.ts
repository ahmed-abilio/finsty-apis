import { fn, col } from 'sequelize';
import sequelize from '@config/database';
import Product from '@modules/product/product.model';
import ProductReview from '@modules/product/product-review.model';
import ProductReviewImage from '@modules/product/product-review-image.model';
import User from '@modules/user/user.model';
import { AppError } from '@utils/appError';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface SubmitReviewInput {
  rating: number;
  comment?: string;
  images?: string[];   // array of S3 URLs
}

export interface ListReviewsInput {
  productId?: string;
  isFlagged?: boolean;
  isApproved?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedReviews {
  items: object[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Aggregate helper ─────────────────────────────────────────────────────────

/**
 * Recalculates averageRating and reviewCount for a product from the DB
 * and updates the product row in-place. Called after every review write.
 */
async function recalculateRating(productId: string): Promise<void> {
  const result = await ProductReview.findOne({
    where: { productId, isApproved: true },
    attributes: [
      [fn('COUNT', col('id')), 'count'],
      [fn('AVG', col('rating')), 'avg'],
    ],
    raw: true,
  }) as any;

  const reviewCount = Number(result?.count ?? 0);
  const averageRating = reviewCount > 0
    ? parseFloat(Number(result?.avg ?? 0).toFixed(2))
    : 0;

  await Product.update({ reviewCount, averageRating }, { where: { id: productId } });
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ReviewService {
  // ── User: Submit review ────────────────────────────────────────────────────

  async submit(productId: string, userId: string, input: SubmitReviewInput) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    // One review per user per product (enforced by DB unique index too)
    const existing = await ProductReview.findOne({ where: { productId, userId } });
    if (existing) {
      throw AppError.conflict('You have already reviewed this product', 'REVIEW_EXISTS');
    }

    if (input.rating < 1 || input.rating > 5) {
      throw AppError.badRequest('Rating must be between 1 and 5', 'INVALID_RATING');
    }

    return sequelize.transaction(async (t) => {
      const review = await ProductReview.create(
        {
          productId,
          userId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
        { transaction: t },
      );

      const reviewImages: ProductReviewImage[] = [];
      if (input.images?.length) {
        const created = await ProductReviewImage.bulkCreate(
          input.images.map((url) => ({ reviewId: review.id, imageUrl: url })),
          { transaction: t },
        );
        reviewImages.push(...created);
      }

      // Update cached aggregate on product
      await recalculateRating(productId);

      return {
        ...review.toPublicJSON(),
        images: reviewImages.map((img) => img.toPublicJSON()),
      };
    });
  }

  // ── User: Flag a review ────────────────────────────────────────────────────

  async flag(reviewId: string, userId: string, reason?: string) {
    const review = await ProductReview.findByPk(reviewId);
    if (!review) throw AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');
    if (review.userId === userId) {
      throw AppError.badRequest('You cannot flag your own review', 'CANNOT_FLAG_OWN_REVIEW');
    }

    await review.update({ isFlagged: true, flagReason: reason ?? null });
    return review.toPublicJSON();
  }

  // ── Get reviews for a product (public, approved only) ─────────────────────

  async listForProduct(productId: string, page = 1, limit = 20): Promise<PaginatedReviews> {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));
    const offset = (page - 1) * limit;

    const { count, rows } = await ProductReview.findAndCountAll({
      where: { productId, isApproved: true },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: ProductReviewImage, as: 'images' },
        { model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] },
      ],
    });

    return {
      items: rows.map((r) => ({
        ...r.toPublicJSON(),
        images: ((r as any).images as ProductReviewImage[] ?? []).map((img) => img.toPublicJSON()),
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

  // ── Admin: List reviews with optional filters ──────────────────────────────

  async adminList(input: ListReviewsInput): Promise<PaginatedReviews> {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: any = {};
    if (input.productId) where.productId = input.productId;
    if (input.isFlagged !== undefined) where.isFlagged = input.isFlagged;
    if (input.isApproved !== undefined) where.isApproved = input.isApproved;

    const { count, rows } = await ProductReview.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: ProductReviewImage, as: 'images' },
        { model: User, as: 'user', attributes: ['id', 'name', 'profileImage'] },
        { model: Product, as: 'product', attributes: ['id', 'name'] },
      ],
    });

    return {
      items: rows.map((r) => ({
        ...r.toPublicJSON(),
        images: ((r as any).images as ProductReviewImage[] ?? []).map((img) => img.toPublicJSON()),
        user: (r as any).user
          ? { id: (r as any).user.id, name: (r as any).user.name ?? null }
          : null,
        product: (r as any).product
          ? { id: (r as any).product.id, name: (r as any).product.name }
          : null,
      })),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ── Admin: Reply to a review ───────────────────────────────────────────────

  async respond(reviewId: string, response: string) {
    const review = await ProductReview.findByPk(reviewId);
    if (!review) throw AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');

    await review.update({ response });
    return review.toPublicJSON();
  }

  // ── Admin: Toggle isApproved (show / hide review) ─────────────────────────

  async setStatus(reviewId: string, isApproved: boolean) {
    const review = await ProductReview.findByPk(reviewId);
    if (!review) throw AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');

    const productId = review.productId;
    await review.update({ isApproved });

    // Recalculate since an approval change affects the cached aggregate
    await recalculateRating(productId);

    return review.toPublicJSON();
  }
}

export default new ReviewService();
