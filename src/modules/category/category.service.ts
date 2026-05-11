import { Op } from 'sequelize';
import Category from './category.model';
import Product from '@modules/product/product.model';
import SubCategory from '@modules/sub-category/sub-category.model';
import { AppError } from '@utils/appError';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CategoryService {
  async create(input: CreateCategoryInput) {
    const existing = await Category.findOne({ where: { name: input.name } });
    if (existing) {
      throw AppError.conflict(
        `Category with name '${input.name}' already exists`,
        'CATEGORY_EXISTS',
      );
    }

    const category = await Category.create({
      name: input.name,
      description: input.description ?? null,
    });

    return category.toPublicJSON();
  }

  async list(onlyActive: boolean) {
    const where = onlyActive ? { isActive: true } : {};
    const categories = await Category.findAll({
      where,
      include: [{ model: SubCategory, as: 'subCategories' }],
      order: [
        ['name', 'ASC'],
        [{ model: SubCategory, as: 'subCategories' }, 'name', 'ASC'],
      ],
    });
    return categories.map((c) => c.toPublicJSON());
  }

  async getById(id: string) {
    const category = await Category.findByPk(id, {
      include: [{ model: SubCategory, as: 'subCategories' }],
    });
    if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
    return category.toPublicJSON();
  }

  async update(id: string, input: UpdateCategoryInput) {
    const category = await Category.findByPk(id);
    if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');

    if (input.name && input.name !== category.name) {
      const conflict = await Category.findOne({
        where: { name: input.name, id: { [Op.ne]: id } },
      });
      if (conflict) {
        throw AppError.conflict(
          `Category with name '${input.name}' already exists`,
          'CATEGORY_EXISTS',
        );
      }
    }

    await category.update(input);
    return category.toPublicJSON();
  }

  async remove(id: string) {
    const category = await Category.findByPk(id);
    if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');

    const inUse = await Product.findOne({ where: { categoryId: id } });
    if (inUse) {
      throw AppError.conflict(
        'Cannot delete category — it is referenced by one or more products',
        'CATEGORY_IN_USE',
      );
    }

    await category.destroy();
  }
}

export default new CategoryService();
