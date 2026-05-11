import { FastifyRequest, FastifyReply } from 'fastify';
import productService from './product.service';
import type {
  ListProductsInput,
  ListDraftsInput,
  CreateProductInput,
  UpdateProductInput,
  FullUpdateProductInput,
  ColorInput,
  UpdateColorInput,
  ColorImageInput,
  VariantInput,
  UpdateVariantInput,
} from './product.service';
import { Roles } from '@modules/user/user.model';

// ─── Param / query interfaces ─────────────────────────────────────────────────

interface ProductParams {
  productId: string;
}

interface ColorParams {
  productId: string;
  colorId: string;
}

interface ColorImageParams {
  productId: string;
  colorId: string;
  imageId: string;
}

interface VariantParams {
  productId: string;
  colorId: string;
  variantId: string;
}

interface ImageParams {
  productId: string;
  imageId: string;
}

interface DeleteProductQuery {
  hard?: boolean;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class ProductController {
  private isAdmin(request: FastifyRequest): boolean {
    return request.user.role === Roles.ADMIN;
  }

  // ── Public brand list ──────────────────────────────────────────────────────

  async listBrands(
    request: FastifyRequest<{ Querystring: { storeIds?: string[] } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const brands = await productService.listBrands(request.query.storeIds);
    void reply.status(200).send({ success: true, data: { brands } });
  }

  // ── Public listing ─────────────────────────────────────────────────────────

  async list(
    request: FastifyRequest<{ Querystring: ListProductsInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await productService.list({
      ...request.query,
      currentUserId: request.user?.sub,
    });
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

  // ── Product CRUD ───────────────────────────────────────────────────────────

  async create(
    request: FastifyRequest<{ Body: CreateProductInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const body = { ...request.body };

    // Auto-resolve storeId for vendors if not provided
    if (!body.storeId) {
      if (this.isAdmin(request)) {
        void reply.status(400).send({
          success: false,
          error: { code: 'MISSING_STORE_ID', message: 'Admins must specify storeId' },
        });
        return;
      }
      const Store = (await import('@modules/store/store.model')).default;
      const store = await Store.findOne({ where: { ownerId: request.user.sub } });
      if (!store) {
        void reply.status(404).send({
          success: false,
          error: { code: 'STORE_NOT_FOUND', message: 'No store found for this vendor' },
        });
        return;
      }
      body.storeId = store.id;
    }

    const product = await productService.create(
      body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(201).send({ success: true, data: { product } });
  }

  async getOne(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const product = await productService.findById(request.params.productId, request.user?.sub);
    void reply.status(200).send({ success: true, data: { product } });
  }

  async publish(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const product = await productService.publish(
      request.params.productId,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { product } });
  }

  async listDrafts(
    request: FastifyRequest<{ Querystring: ListDraftsInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await productService.listDrafts(
      request.query,
      request.user.sub,
      this.isAdmin(request),
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

  async getBySlug(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const product = await productService.findBySlug(request.params.slug, request.user?.sub);
    void reply.status(200).send({ success: true, data: { product } });
  }

  async update(
    request: FastifyRequest<{ Params: ProductParams; Body: UpdateProductInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const product = await productService.update(
      request.params.productId,
      request.body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { product } });
  }

  async fullUpdate(
    request: FastifyRequest<{ Params: ProductParams; Body: FullUpdateProductInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const product = await productService.fullUpdate(
      request.params.productId,
      request.body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { product } });
  }

  async remove(
    request: FastifyRequest<{ Params: ProductParams; Querystring: DeleteProductQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    await productService.remove(
      request.params.productId,
      request.user.sub,
      this.isAdmin(request),
      request.query.hard,
    );
    void reply.status(200).send({ success: true, data: { message: 'Product deleted successfully' } });
  }

  // ── Colour management ──────────────────────────────────────────────────────

  async addColor(
    request: FastifyRequest<{ Params: ProductParams; Body: ColorInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const color = await productService.addColor(
      request.params.productId,
      request.body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(201).send({ success: true, data: { color } });
  }

  async updateColor(
    request: FastifyRequest<{ Params: ColorParams; Body: UpdateColorInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const color = await productService.updateColor(
      request.params.productId,
      request.params.colorId,
      request.body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { color } });
  }

  async removeColor(
    request: FastifyRequest<{ Params: ColorParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await productService.removeColor(
      request.params.productId,
      request.params.colorId,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { message: 'Colour deleted successfully' } });
  }

  // ── Colour image management ────────────────────────────────────────────────

  async addColorImage(
    request: FastifyRequest<{ Params: ColorParams; Body: ColorImageInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const image = await productService.addColorImage(
      request.params.productId,
      request.params.colorId,
      request.body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(201).send({ success: true, data: { image } });
  }

  async removeColorImage(
    request: FastifyRequest<{ Params: ColorImageParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await productService.removeColorImage(
      request.params.productId,
      request.params.colorId,
      request.params.imageId,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { message: 'Image deleted successfully' } });
  }

  // ── Variant (SKU) management ───────────────────────────────────────────────

  async addVariant(
    request: FastifyRequest<{ Params: ColorParams; Body: VariantInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const variant = await productService.addVariant(
      request.params.productId,
      request.params.colorId,
      request.body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(201).send({ success: true, data: { variant } });
  }

  async updateVariant(
    request: FastifyRequest<{ Params: VariantParams; Body: UpdateVariantInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const variant = await productService.updateVariant(
      request.params.productId,
      request.params.colorId,
      request.params.variantId,
      request.body,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { variant } });
  }

  async removeVariant(
    request: FastifyRequest<{ Params: VariantParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await productService.removeVariant(
      request.params.productId,
      request.params.colorId,
      request.params.variantId,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { message: 'Variant deleted successfully' } });
  }

  // ── Product-level image management ────────────────────────────────────────

  async addImage(
    request: FastifyRequest<{ Params: ProductParams; Body: { url: string; position?: number } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const image = await productService.addImage(
      request.params.productId,
      request.body.url,
      request.body.position ?? 0,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(201).send({ success: true, data: { image } });
  }

  async removeImage(
    request: FastifyRequest<{ Params: ImageParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await productService.removeImage(
      request.params.productId,
      request.params.imageId,
      request.user.sub,
      this.isAdmin(request),
    );
    void reply.status(200).send({ success: true, data: { message: 'Image deleted successfully' } });
  }
}

export default new ProductController();
