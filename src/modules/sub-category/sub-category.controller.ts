import { FastifyRequest, FastifyReply } from 'fastify';
import subCategoryService from './sub-category.service';
import type { CreateSubCategoryInput, UpdateSubCategoryInput } from './sub-category.service';

// ─── Param / query interfaces ─────────────────────────────────────────────────

interface CategoryParams {
  categoryId: string;
}

interface SubCategoryParams {
  subCategoryId: string;
}

interface ListSubCategoriesQuery {
  activeOnly?: boolean;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class SubCategoryController {
  async create(
    request: FastifyRequest<{ Params: CategoryParams; Body: CreateSubCategoryInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const subCategory = await subCategoryService.create(
      request.params.categoryId,
      request.body,
    );
    void reply.status(201).send({ success: true, data: { subCategory } });
  }

  async listByCategory(
    request: FastifyRequest<{ Params: CategoryParams; Querystring: ListSubCategoriesQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const subCategories = await subCategoryService.listByCategory(
      request.params.categoryId,
      request.query.activeOnly ?? false,
    );
    void reply.status(200).send({ success: true, data: { subCategories } });
  }

  async getOne(
    request: FastifyRequest<{ Params: SubCategoryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const subCategory = await subCategoryService.getById(request.params.subCategoryId);
    void reply.status(200).send({ success: true, data: { subCategory } });
  }

  async update(
    request: FastifyRequest<{ Params: SubCategoryParams; Body: UpdateSubCategoryInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const subCategory = await subCategoryService.update(
      request.params.subCategoryId,
      request.body,
    );
    void reply.status(200).send({ success: true, data: { subCategory } });
  }

  async remove(
    request: FastifyRequest<{ Params: SubCategoryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await subCategoryService.remove(request.params.subCategoryId);
    void reply
      .status(200)
      .send({ success: true, data: { message: 'Sub-category deleted successfully' } });
  }
}

export default new SubCategoryController();
