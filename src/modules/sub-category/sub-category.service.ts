import { Op } from 'sequelize';
import SubCategory from './sub-category.model';
import Category from '@modules/category/category.model';
import Product from '@modules/product/product.model';
import { AppError } from '@utils/appError';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateSubCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateSubCategoryInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class SubCategoryService {
  async create(categoryId: string, input: CreateSubCategoryInput) {
    const category = await Category.findByPk(categoryId);
    if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');

    const existing = await SubCategory.findOne({
      where: { categoryId, name: input.name },
    });
    if (existing) {
      throw AppError.conflict(
        `Sub-category '${input.name}' already exists within this category`,
        'SUB_CATEGORY_EXISTS',
      );
    }

    const subCategory = await SubCategory.create({
      categoryId,
      name: input.name,
      description: input.description ?? null,
    });

    return subCategory.toPublicJSON();
  }

  async listByCategory(categoryId: string, onlyActive: boolean) {
    const category = await Category.findByPk(categoryId);
    if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');

    const where: Record<string, unknown> = { categoryId };
    if (onlyActive) where.isActive = true;

    const subCategories = await SubCategory.findAll({ where, order: [['name', 'ASC']] });
    return subCategories.map((s) => s.toPublicJSON());
  }

  async getById(id: string) {
    const subCategory = await SubCategory.findByPk(id);
    if (!subCategory) throw AppError.notFound('Sub-category not found', 'SUB_CATEGORY_NOT_FOUND');
    return subCategory.toPublicJSON();
  }

  async update(id: string, input: UpdateSubCategoryInput) {
    const subCategory = await SubCategory.findByPk(id);
    if (!subCategory) throw AppError.notFound('Sub-category not found', 'SUB_CATEGORY_NOT_FOUND');

    if (input.name && input.name !== subCategory.name) {
      const conflict = await SubCategory.findOne({
        where: {
          categoryId: subCategory.categoryId || (subCategory as any).category_id,
          name: input.name,
          id: { [Op.ne]: id },
        },
      });
      if (conflict) {
        throw AppError.conflict(
          `Sub-category '${input.name}' already exists within this category`,
          'SUB_CATEGORY_EXISTS',
        );
      }
    }

    await subCategory.update(input);
    return subCategory.toPublicJSON();
  }

  async remove(id: string) {
    const subCategory = await SubCategory.findByPk(id);
    if (!subCategory) throw AppError.notFound('Sub-category not found', 'SUB_CATEGORY_NOT_FOUND');

    const inUse = await Product.findOne({ where: { subCategoryId: id } });
    if (inUse) {
      throw AppError.conflict(
        'Cannot delete sub-category — it is referenced by one or more products',
        'SUB_CATEGORY_IN_USE',
      );
    }

    await subCategory.destroy();
  }
}

export default new SubCategoryService();
