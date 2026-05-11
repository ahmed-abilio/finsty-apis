import { FastifyRequest, FastifyReply } from 'fastify';
import brandService from './brand.service';

interface StoreParams {
  storeId: string;
}

interface BrandParams {
  storeId: string;
  brandId: string;
}

interface CreateBrandBody {
  name: string;
  logoUrl?: string;
  isActive?: boolean;
}

interface UpdateBrandBody {
  name?: string;
  logoUrl?: string;
  isActive?: boolean;
}

interface ListBrandsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

class BrandController {
  async list(
    request: FastifyRequest<{ Params: StoreParams; Querystring: ListBrandsQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { page, limit, search, status } = request.query;
    const isActive = status === 'active' ? true : status === 'inactive' ? false : undefined;
    const result = await brandService.listBrands(request.params.storeId, { isActive, page, limit, search });
    void reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Params: StoreParams; Body: CreateBrandBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const brand = await brandService.createBrand(
      request.params.storeId,
      request.user.sub,
      request.body,
    );
    void reply.status(201).send({ success: true, data: { brand: brand.toPublicJSON() } });
  }

  async update(
    request: FastifyRequest<{ Params: BrandParams; Body: UpdateBrandBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const brand = await brandService.updateBrand(
      request.params.brandId,
      request.params.storeId,
      request.user.sub,
      request.body,
    );
    void reply.status(200).send({ success: true, data: { brand: brand.toPublicJSON() } });
  }

  async remove(
    request: FastifyRequest<{ Params: BrandParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const brand = await brandService.deleteBrand(
      request.params.brandId,
      request.params.storeId,
      request.user.sub,
    );
    void reply.status(200).send({ success: true, data: { brand: brand.toPublicJSON() } });
  }
}

export default new BrandController();
