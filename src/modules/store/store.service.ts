import { Op, WhereOptions, literal } from 'sequelize';
import Store, { 
  StoreGender, 
  StoreCat, 
  BankDetails, 
  StoreAttributes,
  StoreCreationAttributes 
} from './store.model';
import { generateUniqueSlug } from '@utils/slugify';
import Category from '@modules/category/category.model';
import Brand from '@modules/brand/brand.model';
import SubCategory from '@modules/sub-category/sub-category.model';
import Product from '@modules/product/product.model';
import ProductImage from '@modules/product/product-image.model';
import ProductColor from '@modules/product/product-color.model';
import ProductColorImage from '@modules/product/product-color-image.model';
import ProductVariant from '@modules/product/product-variant.model';
import User, { Roles } from '@modules/user/user.model';
import userService from '@modules/user/user.service';
import { AppError } from '@utils/appError';
import brandService from '@modules/brand/brand.service';
import sequelize from '@config/database';
import logger from '@utils/logger';
import otpService from '@modules/otp/otp.service';
import vendorDashboardService from './vendorDashboard.service';
import vendorRevenueService from './vendorRevenue.service';
import { stockStatusWhere } from '@modules/product/productStock.util';
import type { DateRange } from './vendorDashboard.utils';
import { formatVendorProduct, type ProductWithVendorAssocs } from './vendorProductFormat';

// IFSC: 4 uppercase letters + '0' + 6 alphanumeric chars (RBI standard)
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
// Account number: 9–18 digits (covers all Indian banks)
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;

export interface StoreSearchQuery {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  gender?: StoreGender;
  categoryId?: string;
  minRating?: number;
  search?: string;
  city?: string;
  isActive?: boolean | 'all';
  onboardingStatus?: string;
  page?: number;
  limit?: number;
}

export interface CategoryExplorerQuery {
  categoryType?: string;
  city?: string;
  isActive?: boolean;
  gender?: StoreGender;
}

export interface ProductSearchQuery {
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

// Body type accepted by the vendor application endpoint.
// ownerId is NOT in the body — it is injected by the controller from the JWT.
export type VendorApplicationData = Omit<StoreCreationAttributes, 'id' | 'ownerId'> & {
  ownerId: string;
};

export interface VendorProductQuery {
  isActive?: boolean;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'low_stock';
  categoryId?: string;
  subCategoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

class StoreService {
  // ─── Submit vendor application ────────────────────────────────────────────────
  //
  // Creates a store in PENDING / inactive state.
  // Role upgrade happens only at approval time.

  async create(data: VendorApplicationData): Promise<Store> {
    const { phone, email, ownerId, storeCategories, bankDetails } = data;

    // 1. Verify claimed contact channels via OTP (proves ownership)
    if (phone) await otpService.assertPhoneVerified(phone);
    if (email) await otpService.assertEmailVerified(email);

    // 2. Validate store categories against DB
    if (storeCategories && storeCategories.length > 0) {
      await this.validateStoreCategories(storeCategories);
    }

    // 4. Validate bank details format if provided
    if (bankDetails) {
      this.validateBankDetails(bankDetails);
    }

    // 5. Owner check (only if provided) — role-split tables, not legacy users-only lookup
    if (ownerId) {
      const owner = await userService.findStoreOwnerById(ownerId);
      if (!owner) throw AppError.notFound('Owner user not found', 'OWNER_NOT_FOUND');

      // Prevent duplicate applications for the same owner
      const existingStore = await Store.findOne({ where: { ownerId } });
      if (existingStore) {
        throw AppError.conflict(
          'A store application already exists for this account',
          'OWNER_ALREADY_HAS_STORE',
        );
      }
    }

    // 6. Create store in PENDING state — role stays USER until approval
    const slug = await generateUniqueSlug(data.name, Store);
    const store = await Store.create({
      ...data,
      slug,
      isActive: false,
      isVerified: false,
      onboardingStatus: 'PENDING',
    } as StoreCreationAttributes);

    console.log(`[StoreService] Successfully created store for owner ${ownerId}. Store ID: ${store.id}`);

    // 7. Clean up OTP verified flags (best-effort, non-blocking)
    await otpService.clearVerifiedFlags(phone, email);

    return store.reload();
  }

  // ─── Approve / reject a vendor application (admin) ────────────────────────────

  async approveVendor(
    storeId: string,
    status: 'APPROVED' | 'REJECTED',
    _remarks?: string,
  ): Promise<Store> {
    const store = await Store.findByPk(storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');

    if (store.onboardingStatus !== 'PENDING') {
      throw AppError.conflict(
        'This store application has already been reviewed',
        'APPLICATION_ALREADY_REVIEWED',
      );
    }

    const t = await sequelize.transaction();
    try {
      if (status === 'APPROVED') {
        await store.update(
          { onboardingStatus: 'APPROVED', isActive: true, isVerified: true },
          { transaction: t },
        );

        // Atomically upgrade owner role to VENDOR if owner exists
        if (store.ownerId) {
          const lockedOwner = await User.findOne({
            where: { id: store.ownerId },
            lock: t.LOCK.UPDATE,
            transaction: t,
          });
          if (lockedOwner) {
            await lockedOwner.update({ role: Roles.VENDOR }, { transaction: t });
          }
        }
      } else {
        await store.update({ onboardingStatus: 'REJECTED' }, { transaction: t });
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      if (err instanceof AppError) throw err;
      logger.error({ err, storeId, status }, 'Vendor approval transaction failed');
      throw AppError.internal('Vendor approval failed', 'APPROVAL_FAILED');
    }

    return store.reload();
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  async search(query: StoreSearchQuery) {
    const {
      lat,
      lng,
      radiusKm = parseFloat(process.env.GEOFENCE_RADIUS_KM ?? '10'),
      gender,
      categoryId,
      minRating,
      search,
      city,
      isActive,
      onboardingStatus,
      page = 1,
      limit = 20,
    } = query;

    const offset = (page - 1) * limit;

    const where: any = {};

    // 1. Role/Status Filtering
    // If isActive is explicitly passed (true/false), use it.
    // If isActive is 'all', don't filter by activity.
    // If isActive is omitted, default to true (public behavior).
    if (isActive !== undefined) {
      if (isActive !== ('all' as any)) {
        (where as any).isActive = isActive;
      }
    } else {
      (where as any).isActive = true;
    }

    if (onboardingStatus) {
      (where as any).onboardingStatus = onboardingStatus;
    }

    if (search) {
      (where as Record<string, unknown>)[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (gender) {
      (where as Record<string, unknown>)['genders'] = { [Op.contains]: [gender] };
    }

    if (categoryId) {
      (where as Record<string, unknown>)['storeCategories'] = { [Op.contains]: [{ categoryId }] };
    }

    if (minRating !== undefined) {
      (where as Record<string, unknown>)['rating'] = { [Op.gte]: minRating };
    }

    if (city) {
      (where as Record<string, unknown>)['city'] = { [Op.iLike]: `%${city}%` };
    }

    let distanceLiteral: ReturnType<typeof literal> | null = null;
    let havingClause: ReturnType<typeof literal> | null = null;

    if (lat !== undefined && lng !== undefined) {
      distanceLiteral = literal(
        `(6371 * acos(LEAST(1, cos(radians(${lat})) * cos(radians(CAST("Store"."latitude" AS float))) * ` +
        `cos(radians(CAST("Store"."longitude" AS float)) - radians(${lng})) + ` +
        `sin(radians(${lat})) * sin(radians(CAST("Store"."latitude" AS float))))))`,
      );
      havingClause = literal(
        `(6371 * acos(LEAST(1, cos(radians(${lat})) * cos(radians(CAST("Store"."latitude" AS float))) * ` +
        `cos(radians(CAST("Store"."longitude" AS float)) - radians(${lng})) + ` +
        `sin(radians(${lat})) * sin(radians(CAST("Store"."latitude" AS float)))))) <= ${radiusKm}`,
      );
    }

    const baseOptions = {
      where,
      limit,
      offset,
      distinct: true,
    };

    const findOptions = distanceLiteral
      ? {
          ...baseOptions,
          order: [[distanceLiteral, 'ASC']] as [ReturnType<typeof literal>, string][],
          attributes: { include: [[distanceLiteral, 'distance']] as [ReturnType<typeof literal>, string][] },
          having: havingClause!,
          group: ['Store.id'],
        }
      : {
          ...baseOptions,
          order: [['rating', 'DESC'], ['createdAt', 'DESC']] as [string, string][],
        };

    const { count, rows } = await Store.findAndCountAll(findOptions as any);

    return {
      stores: rows.map((s) => s.toPublicJSON()),
      total: Array.isArray(count) ? count.length : count,
      page,
      limit,
    };
  }

  async update(storeId: string, data: Partial<StoreAttributes>): Promise<Store> {
    const store = await Store.findByPk(storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
    if (data.storeCategories !== undefined) {
      await this.validateStoreCategories(data.storeCategories);
    }
    return store.update(data);
  }

  async delete(storeId: string): Promise<void> {
    const store = await Store.findByPk(storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
    await store.destroy();
  }

  async findBySlug(slug: string): Promise<Store> {
    const where: any = { slug, isActive: true };
    const store = await Store.findOne({ where });
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
    return store;
  }

  async findByOwnerId(ownerId: string): Promise<Store | null> {
    if (!ownerId) {
      logger.warn('StoreService.findByOwnerId called with undefined/null ownerId');
      return null;
    }
    return Store.findOne({ where: { ownerId } });
  }

  async findById(id: string, includeInactive = false, isActiveFilter?: boolean): Promise<Store> {
    id = id.trim();
    if (!id) {
      throw AppError.badRequest('Store ID is required');
    }
    const where: any = { id };
    if (isActiveFilter !== undefined) {
      where.isActive = isActiveFilter;
    } else if (!includeInactive) {
      where.isActive = true;
    }
    const store = await Store.findOne({ where });
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
    return store;
  }

  async toggleActive(storeId: string, isActive: boolean): Promise<Store> {
    const store = await this.findById(storeId, true);
    return store.update({ isActive });
  }

  async findByOwner(ownerId: string): Promise<Store> {
    if (!ownerId) {
      throw AppError.badRequest('Owner ID is required');
    }
    const store = await Store.findOne({ where: { ownerId } });
    if (!store) throw AppError.notFound('Store not found for this account', 'STORE_NOT_FOUND');
    return store;
  }

  async updateBrands(storeId: string, brands: string[]): Promise<string[]> {
    const store = await Store.findByPk(storeId);
    if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
    const cleaned = [...new Set(brands.map((b) => b.trim()).filter(Boolean))];
    await brandService.validateBrandIds(cleaned, storeId);
    await store.update({ brands: cleaned });
    return cleaned;
  }

  async getProducts(storeId: string, query: ProductSearchQuery) {
    await this.findById(storeId);

    const {
      gender,
      categoryType,
      brand,
      minPrice,
      maxPrice,
      inStock,
      search,
      page = 1,
      limit = 20,
    } = query;

    const offset = (page - 1) * limit;
    const where: WhereOptions = { storeId, isActive: true };

    if (search) {
      (where as Record<string, unknown>)[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (gender) (where as Record<string, unknown>)['gender'] = gender;
    if (categoryType) (where as Record<string, unknown>)['categoryType'] = categoryType;
    if (brand) (where as Record<string, unknown>)['brand'] = { [Op.iLike]: `%${brand}%` };
    if (inStock !== undefined) (where as Record<string, unknown>)['inStock'] = inStock;

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceWhere: Record<string, number> = {};
      if (minPrice !== undefined) priceWhere[Op.gte as unknown as string] = minPrice;
      if (maxPrice !== undefined) priceWhere[Op.lte as unknown as string] = maxPrice;
      (where as Record<string, unknown>)['basePrice'] = priceWhere;
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: ProductImage, as: 'images', order: [['position', 'ASC']] },
        { model: ProductVariant, as: 'variants' },
      ],
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    return {
      products: rows.map((p) => ({
        ...p.toPublicJSON(),
        images: ((p as unknown as { images: ProductImage[] }).images ?? []).map((i) =>
          i.toPublicJSON(),
        ),
        variants: ((p as unknown as { variants: ProductVariant[] }).variants ?? []).map((v) =>
          v.toPublicJSON(),
        ),
      })),
      total: count,
      page,
      limit,
    };
  }

  async getStoreAttributes(storeId: string) {
    await this.findById(storeId);

    const [colorRows, sizeRows] = await Promise.all([
      ProductColor.findAll({
        include: [{
          model: Product,
          as: 'product',
          where: { storeId, isActive: true, status: 'active' },
          attributes: [],
          required: true,
        }],
        attributes: ['colorName', 'colorHex'],
      }),
      ProductVariant.findAll({
        include: [{
          model: Product,
          as: 'product',
          where: { storeId, isActive: true, status: 'active' },
          attributes: [],
          required: true,
        }],
        where: { size: { [Op.not]: null } },
        attributes: ['size'],
      }),
    ]);

    const colorMap = new Map<string, { colorName: string; colorHex: string | null }>();
    for (const row of colorRows) {
      const name = row.colorName;
      if (name && !colorMap.has(name)) {
        colorMap.set(name, { colorName: name, colorHex: (row as any).colorHex ?? null });
      }
    }

    const sizes = [...new Set(sizeRows.map((v) => (v as any).size as string))];

    return {
      colors: [...colorMap.values()],
      sizes,
    };
  }

  async getProductById(storeId: string, productId: string) {
    const product = await Product.findOne({
      where: { id: productId, storeId, isActive: true },
      include: [
        { model: ProductImage, as: 'images', order: [['position', 'ASC']] },
        { model: ProductVariant, as: 'variants' },
      ],
    });

    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    return {
      ...product.toPublicJSON(),
      images: ((product as unknown as { images: ProductImage[] }).images ?? []).map((i) =>
        i.toPublicJSON(),
      ),
      variants: ((product as unknown as { variants: ProductVariant[] }).variants ?? []).map((v) =>
        v.toPublicJSON(),
      ),
    };
  }

  // ─── Category / SubCategory validation ───────────────────────────────────────

  private async validateStoreCategories(storeCategories: StoreCat[]): Promise<void> {
    for (const entry of storeCategories) {
      const category = await Category.findOne({
        where: { id: entry.categoryId, isActive: true },
      });
      if (!category) {
        throw AppError.badRequest(
          `Category '${entry.categoryId}' not found or is inactive`,
          'INVALID_CATEGORY',
        );
      }

      for (const subCatId of entry.subCategoryIds) {
        const subCategory = await SubCategory.findOne({
          where: { id: subCatId, categoryId: entry.categoryId, isActive: true },
        });
        if (!subCategory) {
          throw AppError.badRequest(
            `SubCategory '${subCatId}' not found, inactive, or does not belong to category '${entry.categoryId}'`,
            'INVALID_SUBCATEGORY',
          );
        }
      }
    }
  }

  // ─── Bank details validation ──────────────────────────────────────────────────

  private validateBankDetails(bankDetails: BankDetails): void {
    if (!IFSC_REGEX.test(bankDetails.ifscCode)) {
      throw AppError.badRequest(
        `Invalid IFSC code '${bankDetails.ifscCode}'. Expected format: ABCD0123456`,
        'INVALID_IFSC_CODE',
      );
    }
    if (!ACCOUNT_NUMBER_REGEX.test(bankDetails.accountNumber)) {
      throw AppError.badRequest(
        'Account number must be 9–18 digits with no spaces or dashes',
        'INVALID_ACCOUNT_NUMBER',
      );
    }
  }

  async getStoreCategoriesById(storeId: string) {
    // includeInactive=true so the endpoint works regardless of store active/onboarding status
    const store = await this.findById(storeId, true);
    const storeCats: StoreCat[] = store.storeCategories || [];
    if (!storeCats.length) return [];

    const categoryIds = storeCats.map((c) => c.categoryId);
    const allSubIds = [...new Set(storeCats.flatMap((c) => c.subCategoryIds))];

    const categories = await Category.findAll({
      where: { id: { [Op.in]: categoryIds } },
      include: [
        {
          model: SubCategory,
          as: 'subCategories',
          // no isActive filter — return all subcategories assigned to the store
          where: allSubIds.length ? { id: { [Op.in]: allSubIds } } : undefined,
          required: false,
        },
      ],
      order: [
        ['name', 'ASC'],
        [{ model: SubCategory, as: 'subCategories' }, 'name', 'ASC'],
      ],
    });

    return categories.map((c) => ({
      ...c.toPublicJSON(),
      subCategories: (((c as any).subCategories as SubCategory[]) ?? []).map((s) => s.toPublicJSON()),
    }));
  }

  async getMyBrands(ownerId: string) {
    const store = await this.findByOwner(ownerId);
    const brands = await Brand.findAll({
      where: { storeId: store.id },
      order: [['name', 'ASC']],
    });
    return brands.map((b) => b.toPublicJSON());
  }

  async getMyProducts(ownerId: string, query: VendorProductQuery) {
    const store = await this.findByOwner(ownerId);

    const {
      isActive,
      stockStatus,
      categoryId,
      subCategoryId,
      search,
      page = 1,
      limit = 20,
    } = query;

    const offset = (page - 1) * limit;
    const filters: WhereOptions[] = [{ storeId: store.id }];

    if (isActive !== undefined) filters.push({ isActive });
    if (stockStatus) filters.push(stockStatusWhere(stockStatus));
    if (categoryId) filters.push({ categoryId });
    if (subCategoryId) filters.push({ subCategoryId });
    if (search) {
      filters.push({ [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }] });
    }

    const where: WhereOptions = filters.length === 1 ? filters[0]! : { [Op.and]: filters };

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: ProductImage, as: 'images', separate: true, order: [['position', 'ASC']] },
        {
          model: ProductColor,
          as: 'colors',
          separate: true,
          include: [
            { model: ProductColorImage, as: 'images', separate: true, order: [['displayOrder', 'ASC']] },
            { model: ProductVariant, as: 'variants', separate: true },
          ],
        },
        { model: Category, as: 'category' },
        { model: SubCategory, as: 'subCategory' },
        { model: Brand, as: 'brandDetail' },
      ],
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    return {
      products: rows.map((p) => formatVendorProduct(p as ProductWithVendorAssocs)),
      total: count,
      page,
      limit,
    };
  }

  async getVendorDashboard(ownerId: string) {
    const store = await this.findByOwner(ownerId);
    return vendorDashboardService.getDashboard(store.id, ownerId);
  }

  async getVendorRevenue(
    ownerId: string,
    range: DateRange,
    page = 1,
    limit = 20,
  ) {
    const store = await this.findByOwner(ownerId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    return vendorRevenueService.getRevenue(store.id, ownerId, range, safePage, safeLimit);
  }

  async getCategoryExplorer(query: CategoryExplorerQuery) {
    const { city, isActive = true, gender } = query;

    const storeWhere: any = { isActive };
    if (city) storeWhere.city = { [Op.iLike]: `%${city}%` };
    if (gender) storeWhere.genders = { [Op.contains]: [gender] };

    const stores = await Store.findAll({
      where: storeWhere,
      attributes: [['store_categories', 'storeCategories']],
      raw: true,
    }) as unknown as { storeCategories: { categoryId: string; subCategoryIds: string[] }[] }[];

    if (!stores.length) return [];

    // Aggregate per-category counts and union of subCategoryIds across all stores
    const countMap = new Map<string, number>();
    const subIdMap = new Map<string, Set<string>>();

    for (const store of stores) {
      const cats = store.storeCategories || [];
      for (const { categoryId, subCategoryIds = [] } of cats) {
        if (!categoryId) continue;
        countMap.set(categoryId, (countMap.get(categoryId) ?? 0) + 1);
        if (!subIdMap.has(categoryId)) subIdMap.set(categoryId, new Set());
        for (const id of subCategoryIds) subIdMap.get(categoryId)!.add(id);
      }
    }

    if (!countMap.size) return [];

    const categoryIds = [...countMap.keys()];
    const allSubIds = [...new Set([...subIdMap.values()].flatMap((s) => [...s]))];

    const categories = await Category.findAll({
      where: { id: { [Op.in]: categoryIds } },
      include: [
        {
          model: SubCategory,
          as: 'subCategories',
          where: allSubIds.length ? { id: { [Op.in]: allSubIds } } : undefined,
          required: false,
        },
      ],
      order: [
        ['name', 'ASC'],
        [{ model: SubCategory, as: 'subCategories' }, 'name', 'ASC'],
      ],
    });

    return categories.map((c) => ({
      ...c.toPublicJSON(),
      storeCount: countMap.get(c.id) ?? 0,
    }));
  }
}

export default new StoreService();
