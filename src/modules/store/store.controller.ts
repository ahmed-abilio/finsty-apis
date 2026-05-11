import { FastifyRequest, FastifyReply } from 'fastify';
import storeService, { StoreSearchQuery, ProductSearchQuery, VendorApplicationData, CategoryExplorerQuery, VendorProductQuery } from './store.service';
import type { StoreGender, StoreAttributes } from './store.model';
import { AppError } from '@utils/appError';

interface StoreParams {
  storeId: string;
}

interface ProductParams {
  storeId: string;
  productId: string;
}

interface StoreQuery {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  gender?: StoreGender;
  categoryId?: string;
  minRating?: number;
  search?: string;
  city?: string;
  page?: number;
  limit?: number;
}

interface ProductQuery {
  gender?: StoreGender;
  categoryType?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

interface ApproveVendorBody {
  status: 'APPROVED' | 'REJECTED';
  remarks?: string;
}

// ownerId is injected from the JWT — not present in the request body
type CreateStoreBody = Omit<VendorApplicationData, 'ownerId'>;
type UpdateStoreBody = Partial<StoreAttributes>;

class StoreController {
  async create(
    request: FastifyRequest<{ Body: CreateStoreBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const ownerId = (request as any).user?.sub || (request.body as any).ownerId;

    if (!ownerId) {
      throw AppError.unauthorized('Authenticated user or ownerId is required');
    }

    const store = await storeService.create({ ...request.body, ownerId });
    void reply.status(201).send({ success: true, data: { store: store.toPublicJSON() } });
  }

  async approveVendor(
    request: FastifyRequest<{ Params: StoreParams; Body: ApproveVendorBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const store = await storeService.approveVendor(
      request.params.storeId,
      request.body.status,
      request.body.remarks,
    );
    void reply.status(200).send({ success: true, data: { store: store.toPublicJSON() } });
  }

  async update(
    request: FastifyRequest<{ Params: StoreParams; Body: UpdateStoreBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const store = await storeService.update(request.params.storeId, request.body);
    void reply.status(200).send({ success: true, data: { store: store.toPublicJSON() } });
  }

  async remove(
    request: FastifyRequest<{ Params: StoreParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await storeService.delete(request.params.storeId);
    void reply.status(200).send({ success: true, data: { message: 'Store deleted successfully' } });
  }

  async list(
    request: FastifyRequest<{ Querystring: StoreQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await storeService.search(request.query as StoreSearchQuery);
    void reply.status(200).send({ success: true, data: result });
  }

  async getOne(
    request: FastifyRequest<{ Params: StoreParams; Querystring: { isActive?: boolean } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const isAdmin = (request as any).user?.role === 'admin';
    const { isActive } = request.query;
    const store = await storeService.findById(request.params.storeId, isAdmin, isActive);
    void reply.status(200).send({ success: true, data: { store: store.toPublicJSON() } });
  }

  async toggleActive(
    request: FastifyRequest<{ Params: StoreParams; Body: { isActive: boolean } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const store = await storeService.toggleActive(request.params.storeId, request.body.isActive);
    void reply.status(200).send({ success: true, data: { store: store.toPublicJSON() } });
  }

  async listProducts(
    request: FastifyRequest<{ Params: StoreParams; Querystring: ProductQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await storeService.getProducts(
      request.params.storeId,
      request.query as ProductSearchQuery,
    );
    void reply.status(200).send({ success: true, data: result });
  }

  async getProduct(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const product = await storeService.getProductById(
      request.params.storeId,
      request.params.productId,
    );
    void reply.status(200).send({ success: true, data: { product } });
  }

  async getMyStore(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const store = await storeService.findByOwner(request.user.sub);
    void reply.status(200).send({ success: true, data: { store: store.toPublicJSON() } });
  }

  async getMyBrands(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const brands = await storeService.getMyBrands(request.user.sub);
    void reply.status(200).send({ success: true, data: { brands } });
  }

  async updateMyBrands(
    request: FastifyRequest<{ Body: { brands: string[] } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const store = await storeService.findByOwner(request.user.sub);
    const brands = await storeService.updateBrands(store.id, request.body.brands);
    void reply.status(200).send({ success: true, data: { brands } });
  }

  async getMyProducts(
    request: FastifyRequest<{ Querystring: VendorProductQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await storeService.getMyProducts((request as any).user.sub, request.query);
    void reply.status(200).send({ success: true, data: result });
  }

  async getStoreAttributes(
    request: FastifyRequest<{ Params: StoreParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const attributes = await storeService.getStoreAttributes(request.params.storeId);
    void reply.status(200).send({ success: true, data: attributes });
  }

  async getStoreCategories(
    request: FastifyRequest<{ Params: StoreParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const categories = await storeService.getStoreCategoriesById(request.params.storeId);
    void reply.status(200).send({ success: true, data: { categories } });
  }

  async exploreCategoryExplorer(
    request: FastifyRequest<{ Querystring: CategoryExplorerQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const categories = await storeService.getCategoryExplorer(request.query);
    void reply.status(200).send({ success: true, data: { categories } });
  }

  async getBySlug(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const store = await storeService.findBySlug(request.params.slug);
    void reply.status(200).send({ success: true, data: { store: store.toPublicJSON() } });
  }
}

export default new StoreController();
