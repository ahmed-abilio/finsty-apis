import { FastifyRequest, FastifyReply } from 'fastify';
import categoryService from './category.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.service';

// ─── Param / query interfaces ─────────────────────────────────────────────────

interface CategoryParams {
  categoryId: string;
}

interface ListCategoriesQuery {
  activeOnly?: boolean;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class CategoryController {
  async create(
    request: FastifyRequest<{ Body: CreateCategoryInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const category = await categoryService.create(request.body);
    void reply.status(201).send({ success: true, data: { category } });
  }

  async list(
    request: FastifyRequest<{ Querystring: ListCategoriesQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const categories = await categoryService.list(request.query.activeOnly ?? false);
    void reply.status(200).send({ success: true, data: { categories } });
  }

  async getOne(
    request: FastifyRequest<{ Params: CategoryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const category = await categoryService.getById(request.params.categoryId);
    void reply.status(200).send({ success: true, data: { category } });
  }

  async update(
    request: FastifyRequest<{ Params: CategoryParams; Body: UpdateCategoryInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const category = await categoryService.update(request.params.categoryId, request.body);
    void reply.status(200).send({ success: true, data: { category } });
  }

  async remove(
    request: FastifyRequest<{ Params: CategoryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await categoryService.remove(request.params.categoryId);
    void reply.status(200).send({ success: true, data: { message: 'Category deleted successfully' } });
  }
}

export default new CategoryController();
