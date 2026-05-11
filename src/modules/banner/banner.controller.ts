import { FastifyRequest, FastifyReply } from 'fastify';
import bannerService, {
  CreatePriceBannerInput,
  UpdatePriceBannerInput,
  CreateStoreDiscountBannerInput,
  UpdateStoreDiscountBannerInput,
  VendorCreateStoreDiscountBannerInput,
} from './banner.service';
import { Roles } from '@modules/user/user.model';

interface BannerParams {
  bannerId: string;
}

interface PriceBannerListQuery {
  isActive?: boolean;
}

interface StoreDiscountBannerListQuery {
  storeId?: string;
  isActive?: boolean;
  isApproved?: boolean;
}

class BannerController {
  // ── Price Banners ────────────────────────────────────────────────────────────

  async createPriceBanner(
    request: FastifyRequest<{ Body: CreatePriceBannerInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const banner = await bannerService.createPriceBanner(request.body, request.user.sub);
    void reply.status(201).send({ success: true, data: { banner: banner.toPublicJSON() } });
  }

  async updatePriceBanner(
    request: FastifyRequest<{ Params: BannerParams; Body: UpdatePriceBannerInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const banner = await bannerService.updatePriceBanner(request.params.bannerId, request.body);
    void reply.status(200).send({ success: true, data: { banner: banner.toPublicJSON() } });
  }

  async deletePriceBanner(
    request: FastifyRequest<{ Params: BannerParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await bannerService.deletePriceBanner(request.params.bannerId);
    void reply.status(200).send({ success: true, data: { message: 'Price banner deleted successfully' } });
  }

  async adminListPriceBanners(
    request: FastifyRequest<{ Querystring: PriceBannerListQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const banners = await bannerService.listPriceBanners({ isActive: request.query.isActive });
    void reply.status(200).send({ success: true, data: { banners } });
  }

  // ── Store Discount Banners (admin) ───────────────────────────────────────────

  async createStoreDiscountBanner(
    request: FastifyRequest<{ Body: CreateStoreDiscountBannerInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const isAdmin = request.user.role === Roles.ADMIN;
    const banner = await bannerService.createStoreDiscountBanner(request.body, request.user.sub, isAdmin);
    void reply.status(201).send({ success: true, data: { banner: banner.toPublicJSON() } });
  }

  async updateStoreDiscountBanner(
    request: FastifyRequest<{ Params: BannerParams; Body: UpdateStoreDiscountBannerInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const banner = await bannerService.updateStoreDiscountBanner(request.params.bannerId, request.body);
    void reply.status(200).send({ success: true, data: { banner: banner.toPublicJSON() } });
  }

  async approveStoreDiscountBanner(
    request: FastifyRequest<{ Params: BannerParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const banner = await bannerService.approveStoreDiscountBanner(request.params.bannerId);
    void reply.status(200).send({ success: true, data: { banner: banner.toPublicJSON() } });
  }

  async deleteStoreDiscountBanner(
    request: FastifyRequest<{ Params: BannerParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await bannerService.deleteStoreDiscountBanner(request.params.bannerId);
    void reply.status(200).send({ success: true, data: { message: 'Store discount banner deleted successfully' } });
  }

  async adminListStoreDiscountBanners(
    request: FastifyRequest<{ Querystring: StoreDiscountBannerListQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { storeId, isActive, isApproved } = request.query;
    const banners = await bannerService.listStoreDiscountBanners({ storeId, isActive, isApproved });
    void reply.status(200).send({ success: true, data: { banners } });
  }

  // ── Store Discount Banners (vendor) ──────────────────────────────────────────

  async vendorCreateStoreDiscountBanner(
    request: FastifyRequest<{ Body: VendorCreateStoreDiscountBannerInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const banner = await bannerService.createVendorStoreDiscountBanner(request.body, request.user.sub);
    void reply.status(201).send({ success: true, data: { banner: banner.toPublicJSON() } });
  }

  async vendorListStoreDiscountBanners(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const banners = await bannerService.listVendorBanners(request.user.sub);
    void reply.status(200).send({ success: true, data: { banners } });
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  async listActiveBanners(
    request: FastifyRequest<{ Querystring: { lat?: number; lng?: number } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { lat, lng } = request.query;
    const coords = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
    const data = await bannerService.listActiveBanners(coords);
    void reply.status(200).send({ success: true, data });
  }
}

export default new BannerController();
