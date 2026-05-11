import { UniqueConstraintError } from 'sequelize';
import Wishlist from './wishlist.model';
import Product from '@modules/product/product.model';
import ProductImage from '@modules/product/product-image.model';
import ProductVariant from '@modules/product/product-variant.model';
import { AppError } from '@utils/appError';

class WishlistService {
  async getWishlist(userId: string) {
    const items = await Wishlist.findAll({
      where: { userId },
      include: [
        {
          model: Product,
          as: 'product',
          include: [
            {
              model: ProductImage,
              as: 'images',
              order: [['position', 'ASC']] as [string, string][],
              limit: 1,
            },
            {
              model: ProductVariant,
              as: 'variants',
              required: false,
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return items.map((item) => this.formatItem(item));
  }

  async addToWishlist(userId: string, productId: string) {
    const product = await Product.findOne({ where: { id: productId, isActive: true } });
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    try {
      await Wishlist.create({ userId, productId });
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw AppError.badRequest('Product already in wishlist', 'ALREADY_IN_WISHLIST');
      }
      throw err;
    }

    return this.getWishlist(userId);
  }

  async removeFromWishlist(userId: string, productId: string) {
    const item = await Wishlist.findOne({ where: { userId, productId } });
    if (!item) throw AppError.notFound('Item not found in wishlist', 'WISHLIST_ITEM_NOT_FOUND');

    await item.destroy();
    return this.getWishlist(userId);
  }

  async toggleWishlist(userId: string, productId: string) {
    const existing = await Wishlist.findOne({ where: { userId, productId } });

    if (existing) {
      await existing.destroy();
      return { wishlisted: false, wishlist: await this.getWishlist(userId) };
    }

    const product = await Product.findOne({ where: { id: productId, isActive: true } });
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await Wishlist.create({ userId, productId });
    return { wishlisted: true, wishlist: await this.getWishlist(userId) };
  }

  async isWishlisted(userId: string, productId: string): Promise<boolean> {
    const item = await Wishlist.findOne({ where: { userId, productId } });
    return item !== null;
  }

  private formatItem(item: Wishlist) {
    const product = (item as unknown as { product: Product }).product;
    const images = ((product as unknown as { images: ProductImage[] }).images ?? []).map((i) =>
      i.toPublicJSON(),
    );
    const variants = (
      (product as unknown as { variants: ProductVariant[] }).variants ?? []
    ).map((v) => v.toPublicJSON());

    return {
      id: item.id,
      productId: item.productId,
      addedAt: item.createdAt?.toISOString?.() ?? null,
      product: { ...product.toPublicJSON(), images, variants },
    };
  }
}

export default new WishlistService();
