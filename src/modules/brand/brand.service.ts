import { Op } from 'sequelize';
import Brand, { BrandCreationAttributes } from './brand.model';
import { AppError } from '@utils/appError';
import { generateSlug } from '@utils/slugify';
import Store from '@modules/store/store.model';

interface CreateBrandInput {
  name: string;
  logoUrl?: string;
  isActive?: boolean;
}

interface UpdateBrandInput {
  name?: string;
  logoUrl?: string;
  isActive?: boolean;
}

interface ListBrandsQuery {
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

interface ListBrandsResult {
  brands: ReturnType<Brand['toPublicJSON']>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class BrandService {
  private async generateStoreScopedSlug(name: string, storeId: string, excludeId?: string): Promise<string> {
    const base = generateSlug(name);
    let slug = base;
    for (let i = 0; i < 10; i++) {
      const where: Record<string, unknown> = { slug, storeId };
      if (excludeId) where.id = { [Op.ne]: excludeId };
      const existing = await Brand.findOne({ where });
      if (!existing) return slug;
      slug = `${base}-${Math.random().toString(36).substring(2, 6)}`;
    }
    return slug;
  }

  private async assertStoreOwner(storeId: string, userId: string): Promise<Store> {
    const store = await Store.findByPk(storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
    if (store.ownerId !== userId) throw AppError.forbidden('You do not own this store', 'STORE_FORBIDDEN');
    return store;
  }

  async createBrand(storeId: string, userId: string, input: CreateBrandInput): Promise<Brand> {
    await this.assertStoreOwner(storeId, userId);
    const name = input.name.trim();
    const existing = await Brand.findOne({ where: { name, storeId } });
    if (existing) {
      throw AppError.conflict(`Brand '${name}' already exists in this store`, 'BRAND_ALREADY_EXISTS');
    }
    const slug = await this.generateStoreScopedSlug(name, storeId);
    try {
      return await Brand.create({ ...input, name, slug, storeId } as BrandCreationAttributes);
    } catch (err: any) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw AppError.conflict(`Brand with name '${name}' or slug '${slug}' already exists`, 'BRAND_ALREADY_EXISTS');
      }
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        throw AppError.notFound('Associated store not found', 'STORE_NOT_FOUND');
      }
      throw err;
    }
  }

  async updateBrand(brandId: string, storeId: string, userId: string, input: UpdateBrandInput): Promise<Brand> {
    await this.assertStoreOwner(storeId, userId);
    const brand = await Brand.findOne({ where: { id: brandId, storeId } });
    if (!brand) throw AppError.notFound('Brand not found', 'BRAND_NOT_FOUND');

    const updateData: Record<string, unknown> = { ...input };

    if (input.name) {
      const name = input.name.trim();
      updateData.name = name;
      const dupe = await Brand.findOne({
        where: { name, storeId, id: { [Op.ne]: brandId } },
      });
      if (dupe) {
        throw AppError.conflict(`Brand '${name}' already exists in this store`, 'BRAND_ALREADY_EXISTS');
      }
      updateData.slug = await this.generateStoreScopedSlug(name, storeId, brandId);
    }

    return brand.update(updateData);
  }

  async deleteBrand(brandId: string, storeId: string, userId: string): Promise<Brand> {
    await this.assertStoreOwner(storeId, userId);
    const brand = await Brand.findOne({ where: { id: brandId, storeId } });
    if (!brand) throw AppError.notFound('Brand not found', 'BRAND_NOT_FOUND');
    return brand.update({ isActive: !brand.isActive });
  }

  async listBrands(storeId: string, query: ListBrandsQuery = {}): Promise<ListBrandsResult> {
    const { isActive, search, page = 1, limit = 20 } = query;
    const where: any = { storeId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search?.trim()) {
      where.name = { [Op.iLike]: `%${search.trim()}%` };
    }

    const { count, rows } = await Brand.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });

    return {
      brands: rows.map((b) => b.toPublicJSON()),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getById(brandId: string, storeId: string): Promise<Brand> {
    const brand = await Brand.findOne({ where: { id: brandId, storeId } });
    if (!brand) throw AppError.notFound('Brand not found', 'BRAND_NOT_FOUND');
    return brand;
  }

  // Validates that all given brand IDs are active and belong to the specified store
  async validateBrandIds(brandIds: string[], storeId: string): Promise<void> {
    if (!brandIds.length) return;

    const found = await Brand.findAll({
      where: { id: { [Op.in]: brandIds }, storeId, isActive: true },
    });

    if (found.length !== brandIds.length) {
      const foundIds = new Set(found.map((b) => b.id));
      const invalid = brandIds.filter((id) => !foundIds.has(id));
      throw AppError.badRequest(
        `The following brand IDs are invalid or inactive: ${invalid.join(', ')}`,
        'INVALID_BRAND_IDS',
      );
    }
  }

  // Returns brands, optionally filtered by storeIds and activity status
  async getBrands(isActive?: boolean, storeIds?: string[]): Promise<ReturnType<Brand['toPublicJSON']>[]> {
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (storeIds?.length) where.storeId = { [Op.in]: storeIds };

    const brands = await Brand.findAll({
      where,
      order: [['name', 'ASC']],
    });

    return brands.map((b) => b.toPublicJSON());
  }
}

export default new BrandService();
