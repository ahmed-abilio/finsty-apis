import { Op } from 'sequelize';
import { PriceBanner, StoreDiscountBanner } from './banner.model';
import { AppError } from '@utils/appError';
import Store from '@modules/store/store.model';
import { getStoreIdsWithinRadius, GEOFENCE_RADIUS_KM } from '@utils/geo';
import {
  notifyAdminsNewBannerApplication,
  notifyVendorBannerApproved,
} from '@modules/notification/notification.banner';
import logger from '@utils/logger';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreatePriceBannerInput {
  title: string;
  imageUrl: string;
  priceThreshold: number;
  isActive?: boolean;
}

export interface UpdatePriceBannerInput {
  title?: string;
  imageUrl?: string;
  priceThreshold?: number;
  isActive?: boolean;
}

export interface CreateStoreDiscountBannerInput {
  storeId: string;
  title: string;
  imageUrl: string;
  discountPercentage: number;
  isActive?: boolean;
}

export interface UpdateStoreDiscountBannerInput {
  title?: string;
  imageUrl?: string;
  discountPercentage?: number;
  isActive?: boolean;
}

export interface VendorCreateStoreDiscountBannerInput {
  title: string;
  imageUrl: string;
  discountPercentage: number;
  isActive?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class BannerService {
  // ── Price Banners ────────────────────────────────────────────────────────────

  async createPriceBanner(input: CreatePriceBannerInput, creatorId: string): Promise<PriceBanner> {
    const banner = await PriceBanner.create({
      title: input.title,
      imageUrl: input.imageUrl,
      priceThreshold: input.priceThreshold,
      isActive: input.isActive ?? true,
      createdBy: creatorId,
    });
    return banner;
  }

  async updatePriceBanner(bannerId: string, input: UpdatePriceBannerInput): Promise<PriceBanner> {
    const banner = await PriceBanner.findByPk(bannerId);
    if (!banner) throw AppError.notFound('Price banner not found', 'PRICE_BANNER_NOT_FOUND');

    if (input.title !== undefined) banner.title = input.title;
    if (input.imageUrl !== undefined) banner.imageUrl = input.imageUrl;
    if (input.priceThreshold !== undefined) banner.priceThreshold = input.priceThreshold;
    if (input.isActive !== undefined) banner.isActive = input.isActive;

    await banner.save();
    return banner;
  }

  async deletePriceBanner(bannerId: string): Promise<void> {
    const banner = await PriceBanner.findByPk(bannerId);
    if (!banner) throw AppError.notFound('Price banner not found', 'PRICE_BANNER_NOT_FOUND');
    await banner.destroy();
  }

  async listPriceBanners(filters: { isActive?: boolean } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const banners = await PriceBanner.findAll({ where, order: [['createdAt', 'DESC']] });
    return banners.map((b) => b.toPublicJSON());
  }

  // ── Store Discount Banners ───────────────────────────────────────────────────

  async createStoreDiscountBanner(
    input: CreateStoreDiscountBannerInput,
    creatorId: string,
    isAdmin = false,
  ): Promise<StoreDiscountBanner> {
    const store = await Store.findByPk(input.storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');

    if (input.discountPercentage < 1 || input.discountPercentage > 100) {
      throw AppError.badRequest('Discount percentage must be between 1 and 100', 'INVALID_DISCOUNT_PERCENTAGE');
    }

    const banner = await StoreDiscountBanner.create({
      storeId: input.storeId,
      title: input.title,
      imageUrl: input.imageUrl,
      discountPercentage: input.discountPercentage,
      isActive: input.isActive ?? true,
      isApproved: isAdmin,
      createdBy: creatorId,
    });
    return banner;
  }

  async createVendorStoreDiscountBanner(
    input: VendorCreateStoreDiscountBannerInput,
    vendorId: string,
  ): Promise<StoreDiscountBanner> {
    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');

    if (input.discountPercentage < 1 || input.discountPercentage > 100) {
      throw AppError.badRequest('Discount percentage must be between 1 and 100', 'INVALID_DISCOUNT_PERCENTAGE');
    }

    const banner = await StoreDiscountBanner.create({
      storeId: store.get('id') as string,
      title: input.title,
      imageUrl: input.imageUrl,
      discountPercentage: input.discountPercentage,
      isActive: input.isActive ?? true,
      isApproved: false,
      createdBy: vendorId,
    });

    void notifyAdminsNewBannerApplication(banner).catch((err) => {
      logger.error({ err, bannerId: banner.id }, 'Failed to notify admins of new banner application');
    });

    return banner;
  }

  async listVendorBanners(vendorId: string) {
    const store = await Store.findOne({ where: { ownerId: vendorId } });
    if (!store) {
      console.warn(`[BannerService] No store found for vendorId: ${vendorId}`);
      throw AppError.forbidden('Vendor has no associated store', 'NO_STORE');
    }

    const storeId = store.get('id') as string;
    if (!storeId) {
      console.error(`[BannerService] Store found for vendor ${vendorId} but id is undefined!`, store.toJSON());
      throw AppError.internal('Store configuration error: missing ID');
    }

    const banners = await StoreDiscountBanner.findAll({
      where: { storeId },
      order: [['createdAt', 'DESC']],
    });
    return banners.map((b) => b.toPublicJSON());
  }

  async updateStoreDiscountBanner(
    bannerId: string,
    input: UpdateStoreDiscountBannerInput,
  ): Promise<StoreDiscountBanner> {
    const banner = await StoreDiscountBanner.findByPk(bannerId);
    if (!banner) throw AppError.notFound('Store discount banner not found', 'STORE_DISCOUNT_BANNER_NOT_FOUND');

    if (input.discountPercentage !== undefined) {
      if (input.discountPercentage < 1 || input.discountPercentage > 100) {
        throw AppError.badRequest('Discount percentage must be between 1 and 100', 'INVALID_DISCOUNT_PERCENTAGE');
      }
      banner.discountPercentage = input.discountPercentage;
    }

    if (input.title !== undefined) banner.title = input.title;
    if (input.imageUrl !== undefined) banner.imageUrl = input.imageUrl;
    if (input.isActive !== undefined) banner.isActive = input.isActive;

    await banner.save();
    return banner;
  }

  async approveStoreDiscountBanner(bannerId: string): Promise<StoreDiscountBanner> {
    const banner = await StoreDiscountBanner.findByPk(bannerId);
    if (!banner) throw AppError.notFound('Store discount banner not found', 'STORE_DISCOUNT_BANNER_NOT_FOUND');
    if (banner.isApproved) throw AppError.badRequest('Banner is already approved', 'ALREADY_APPROVED');

    banner.isApproved = true;
    await banner.save();

    const store = await Store.findByPk(banner.storeId, { attributes: ['ownerId'] });
    if (store?.ownerId) {
      notifyVendorBannerApproved(store.ownerId, banner);
    }

    return banner;
  }

  async deleteStoreDiscountBanner(bannerId: string): Promise<void> {
    const banner = await StoreDiscountBanner.findByPk(bannerId);
    if (!banner) throw AppError.notFound('Store discount banner not found', 'STORE_DISCOUNT_BANNER_NOT_FOUND');
    await banner.destroy();
  }

  async listStoreDiscountBanners(filters: { storeId?: string; isActive?: boolean; isApproved?: boolean } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.storeId !== undefined) where.storeId = filters.storeId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isApproved !== undefined) where.isApproved = filters.isApproved;

    const banners = await StoreDiscountBanner.findAll({ where, order: [['createdAt', 'DESC']] });
    return banners.map((b) => b.toPublicJSON());
  }

  // ── Public (storefront) ──────────────────────────────────────────────────────

  async listActiveBanners(coords?: { lat: number; lng: number }) {
    const discountWhere: Record<string, unknown> = { isActive: true, isApproved: true };

    if (coords) {
      const geoStoreIds = await getStoreIdsWithinRadius(coords.lat, coords.lng, GEOFENCE_RADIUS_KM);
      if (!geoStoreIds.length) {
        const priceBanners = await PriceBanner.findAll({
          where: { isActive: true },
          order: [['createdAt', 'DESC']],
        });
        return {
          priceBanners: priceBanners.map((b) => b.toPublicJSON()),
          storeDiscountBanners: [],
        };
      }
      discountWhere.storeId = { [Op.in]: geoStoreIds };
    }

    const [priceBanners, storeDiscountBanners] = await Promise.all([
      PriceBanner.findAll({ where: { isActive: true }, order: [['createdAt', 'DESC']] }),
      StoreDiscountBanner.findAll({ where: discountWhere, order: [['createdAt', 'DESC']] }),
    ]);

    return {
      priceBanners: priceBanners.map((b) => b.toPublicJSON()),
      storeDiscountBanners: storeDiscountBanners.map((b) => b.toPublicJSON()),
    };
  }
}

export default new BannerService();
