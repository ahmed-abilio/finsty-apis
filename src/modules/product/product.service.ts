import { Transaction, Op, Order } from 'sequelize';
import { getStoreIdsWithinRadius, GEOFENCE_RADIUS_KM } from '@utils/geo';
import sequelize from '@config/database';
import { generateUniqueSlug } from '@utils/slugify';
import Product from './product.model';
import { maybeNotifyVendorStockChange } from '@modules/notification/notification.stock';
import { syncProductStockFromVariants } from './productStock.util';
import ProductColor from './product-color.model';
import ProductColorImage from './product-color-image.model';
import ProductVariant from './product-variant.model';
import ProductImage from './product-image.model';
import Store from '@modules/store/store.model';
import Category from '@modules/category/category.model';
import SubCategory from '@modules/sub-category/sub-category.model';
import { AppError } from '@utils/appError';
import { buildS3PublicUrl } from '@utils/s3Uploader';
import brandService from '@modules/brand/brand.service';
import type { StoreGender } from '@modules/store/store.model';
import { Brand, Wishlist } from '@config/associations';

// ─── Listing types ────────────────────────────────────────────────────────────

export type ProductSortBy =
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'rating'
  | 'discount_desc'
  | 'relevance';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeStringList(value: string | string[] | undefined): string[] {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => String(v).trim()).filter(Boolean);
}

function normalizeSizeChartUrl(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('uploads/')) return buildS3PublicUrl(trimmed);
  return trimmed;
}

export interface ListProductsInput {
  storeIds?: string[];
  categoryIds?: string[];
  /** Brand display names (e.g. Nike) or brand UUIDs — matched via the brands table. */
  brands?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  genders?: StoreGender[];
  hasDiscount?: boolean;
  colors?: string[];      // filter by colorName in ProductColor table
  sizes?: string[];       // filter by size in ProductVariant table
  minRating?: number;
  sortBy?: ProductSortBy;
  lat?: number;
  lng?: number;
  page?: number;
  limit?: number;
  search?: string;
  currentUserId?: string;
  priceUnder?: number;
  discountUnder?: number;
}

export interface PaginatedProducts {
  items: ReturnType<Product['toPublicJSON']>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ColorImageInput {
  imageUrl: string;
  altText?: string;
  displayOrder?: number;
}

export interface VariantInput {
  size?: string;
  sizeChart?: string;
  sku?: string;
  stock?: number;
  additionalPrice?: number;
}

export interface ColorInput {
  colorName: string;
  colorHex?: string;
  images?: ColorImageInput[];
  variants?: VariantInput[];
}

export interface CreateProductInput {
  storeId?: string;
  name?: string;
  description?: string;
  brand?: string;
  gender?: StoreGender;
  categoryType?: string;
  categoryId?: string;
  subCategoryId?: string;
  basePrice?: number;
  discountPercent?: number;
  discountStartDate?: string;
  discountEndDate?: string;
  lowStockThreshold?: number;
  lowStockAlert?: boolean;
  status?: 'draft' | 'active';
  images?: { url: string; position?: number }[];
  colors?: ColorInput[];
}

export interface ListDraftsInput {
  storeId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  brand?: string;
  gender?: StoreGender;
  categoryType?: string;
  categoryId?: string;
  subCategoryId?: string;
  basePrice?: number;
  discountPercent?: number;
  discountStartDate?: string;
  discountEndDate?: string;
  isActive?: boolean;
  inStock?: boolean;
  lowStockThreshold?: number;
  lowStockAlert?: boolean;
  status?: 'draft' | 'active';
}

export interface UpdateColorInput {
  colorName?: string;
  colorHex?: string;
}

export interface UpdateVariantInput {
  size?: string;
  sizeChart?: string;
  sku?: string;
  stock?: number;
  additionalPrice?: number;
}

export interface FullUpdateProductInput extends CreateProductInput {
  isActive?: boolean;
  inStock?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertCategoryRefs(
  categoryId: string | undefined,
  subCategoryId: string | undefined,
): Promise<void> {
  if (!categoryId && !subCategoryId) return;

  if (categoryId) {
    const category = await Category.findByPk(categoryId);
    if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
  }

  if (subCategoryId) {
    const sub = await SubCategory.findByPk(subCategoryId);
    if (!sub) throw AppError.notFound('Sub-category not found', 'SUB_CATEGORY_NOT_FOUND');
    if (categoryId && sub.categoryId !== categoryId) {
      throw AppError.badRequest(
        'Sub-category does not belong to the specified category',
        'SUB_CATEGORY_MISMATCH',
      );
    }
  }
}

async function assertStoreOwnership(
  storeId: string,
  userId: string,
  isAdmin: boolean,
): Promise<Store> {
  console.log(  storeId, "store ----------- ");
  const store = await Store.findByPk(storeId);
  if (!store) throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');

  if (!isAdmin && store.ownerId !== userId) {
    throw AppError.forbidden(
      'You do not have permission to manage products for this store',
      'STORE_ACCESS_DENIED',
    );
  }

  return store;
}

type ProductVisibilityInput = {
  status?: 'draft' | 'active';
  isActive?: boolean;
  name?: string;
  basePrice?: number;
};

function assertProductPublishable(name: string | null | undefined, basePrice: number): void {
  if (!name || name.trim() === '') {
    throw AppError.badRequest('Product must have a name before it can be published', 'PUBLISH_MISSING_NAME');
  }
  if (!basePrice || basePrice <= 0) {
    throw AppError.badRequest(
      'Product must have a valid base price before it can be published',
      'PUBLISH_MISSING_BASE_PRICE',
    );
  }
}

/** Apply status / visibility changes without conflating deactivation with draft. */
function resolveProductVisibilityPatch(
  product: Product,
  input: ProductVisibilityInput,
): Partial<{ status: 'draft' | 'active'; isActive: boolean }> {
  if (input.status === undefined && input.isActive === undefined) {
    return {};
  }

  const patch: Partial<{ status: 'draft' | 'active'; isActive: boolean }> = {};

  if (input.status === 'draft') {
    patch.status = 'draft';
    patch.isActive = false;
    return patch;
  }

  if (input.status === 'active') {
    assertProductPublishable(input.name ?? product.name, Number(input.basePrice ?? product.basePrice));
    patch.status = 'active';
    patch.isActive = input.isActive ?? true;
    return patch;
  }

  if (input.isActive === true) {
    assertProductPublishable(input.name ?? product.name, Number(input.basePrice ?? product.basePrice));
    patch.status = 'active';
    patch.isActive = true;
    return patch;
  }

  if (input.isActive === false) {
    patch.isActive = false;
  }

  return patch;
}

// Serialize a color with its nested images and variants
function serializeColor(
  color: ProductColor,
  images: ProductColorImage[],
  variants: ProductVariant[],
) {
  return {
    ...color.toPublicJSON(),
    images: images.map((img) => img.toPublicJSON()),
    variants: variants.map((v) => v.toPublicJSON()),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ProductService {
  /**
   * Public product listing with filters, sorting, and pagination.
   * Only active products are returned. Color filtering uses a subquery join.
   */
  async list(input: ListProductsInput): Promise<PaginatedProducts> {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const offset = (page - 1) * limit;

    // ── Geofence pre-filter ─────────────────────────────────────────────────
    let resolvedStoreIds = input.storeIds ? [...input.storeIds] : undefined;

    if (input.lat !== undefined && input.lng !== undefined) {
      const geoStoreIds = await getStoreIdsWithinRadius(input.lat, input.lng, GEOFENCE_RADIUS_KM);
      if (resolvedStoreIds?.length) {
        resolvedStoreIds = resolvedStoreIds.filter((id) => geoStoreIds.includes(id));
      } else {
        resolvedStoreIds = geoStoreIds;
      }
      if (!resolvedStoreIds.length) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
    }

    // ── WHERE clause ────────────────────────────────────────────────────────
    const where: any = { isActive: true, status: 'active' };

    if (resolvedStoreIds?.length) {
      (where as any).storeId = { [Op.in]: resolvedStoreIds };
    }
    if (input.categoryIds?.length) {
      (where as any).categoryId = { [Op.in]: input.categoryIds };
    }
    const upperPrice =
      input.priceUnder !== undefined && input.maxPrice !== undefined
        ? Math.min(input.priceUnder, input.maxPrice)
        : input.priceUnder ?? input.maxPrice;

    if (input.minPrice !== undefined || upperPrice !== undefined) {
      (where as any).basePrice = {
        ...(input.minPrice !== undefined ? { [Op.gte]: input.minPrice } : {}),
        ...(upperPrice !== undefined ? { [Op.lte]: upperPrice } : {}),
      };
    }
    if (input.hasDiscount === true || input.discountUnder !== undefined) {
      (where as any).discountPercent = {
        ...(input.hasDiscount === true ? { [Op.gt]: 0 } : {}),
        ...(input.discountUnder !== undefined ? { [Op.lte]: input.discountUnder } : {}),
      };
    }
    if (input.genders?.length) {
      (where as any).gender = { [Op.in]: input.genders };
    }

    const brandTokens = normalizeStringList(input.brands);
    const brandIds = brandTokens.filter((t) => UUID_REGEX.test(t));
    const brandNames = brandTokens.filter((t) => !UUID_REGEX.test(t));

    if (brandIds.length) {
      (where as any).brand = { [Op.in]: brandIds };
    }

    if (input.minRating !== undefined) {
      (where as any).averageRating = { [Op.gte]: input.minRating };
    }
    if (input.search) {
      (where as any).name = { [Op.iLike]: `%${input.search}%` };
    }

    // ── ORDER clause ────────────────────────────────────────────────────────
    const orderMap: Record<ProductSortBy, Order> = {
      price_asc: [['basePrice', 'ASC']],
      price_desc: [['basePrice', 'DESC']],
      newest: [['createdAt', 'DESC']],
      rating: [['averageRating', 'DESC']],
      discount_desc: [['discountPercent', 'DESC']],
      // Relevance: weighted by rating then recency
      relevance: [['averageRating', 'DESC'], ['updatedAt', 'DESC']],
    };
    const order: Order = orderMap[input.sortBy ?? 'newest'];

    // ── Colour filter (INNER JOIN when colors specified) ─────────────────────
    const colorInclude =
      input.colors?.length
        ? {
            model: ProductColor,
            as: 'colors',
            required: true,
            where: { colorName: { [Op.in]: input.colors } },
            attributes: [],
          }
        : { model: ProductColor, as: 'colors', required: false, attributes: [] };

    const brandInclude =
      brandNames.length > 0
        ? {
            model: Brand,
            as: 'brandDetail',
            required: true,
            where: {
              [Op.or]: brandNames.map((name) => ({ name: { [Op.iLike]: name } })),
            },
          }
        : { model: Brand, as: 'brandDetail', required: false };

    // ── Size filter (INNER JOIN on ProductVariant when sizes specified) ───────
    const includes: any[] = [
      colorInclude,
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: SubCategory, as: 'subCategory' },
      brandInclude,
    ];

    if (input.sizes?.length) {
      includes.push({
        model: ProductVariant,
        as: 'variants',
        required: true,
        where: { size: { [Op.in]: input.sizes } },
        attributes: [],
      });
    }

    if (input.currentUserId) {
      includes.push({
        model: Wishlist,
        as: 'wishlists',
        required: false,
        where: { userId: input.currentUserId },
        attributes: ['id'],
      });
    }

    // ── Query ────────────────────────────────────────────────────────────────
    const { count, rows } = await Product.findAndCountAll({
      where,
      order,
      limit,
      offset,
      distinct: true,   // needed when joining 1:M to get the right COUNT
      include: includes,
    });

    return {
      items: rows.map((p) => {
        const res: any = {
          ...p.toPublicJSON(),
          images: ((p as any).images as ProductImage[] ?? []).map((i) => i.toPublicJSON()),
          isWishlisted: input.currentUserId
            ? ((p as any).wishlists as any[] ?? []).length > 0
            : false,
        };
        if ((p as any).category) res.category = (p as any).category.toPublicJSON();
        if ((p as any).subCategory) res.subCategory = (p as any).subCategory.toPublicJSON();
        if ((p as any).brandDetail) res.brand = (p as any).brandDetail.toPublicJSON();
        return res;
      }),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Create a product with optional product-level images and colour groups.
   * Each colour group holds its own images (shared across sizes) and size variants (SKUs).
   */
  // Returns full brand objects from the master Brand table.
  async listBrands(storeIds?: string[]): Promise<any[]> {
    return brandService.getBrands(true, storeIds);
  }

  async create(input: CreateProductInput, requesterId: string, isAdmin: boolean) {
    if (!input.storeId) {
      throw AppError.badRequest('storeId is required', 'MISSING_STORE_ID');
    }
    const storeId = input.storeId;

    await assertStoreOwnership(storeId, requesterId, isAdmin);
    await assertCategoryRefs(input.categoryId, input.subCategoryId);

    // When creating as active (not draft), enforce required fields
    const isDraft = (input.status ?? 'draft') === 'draft';
    if (!isDraft) {
      if (!input.name || input.name.trim() === '') {
        throw AppError.badRequest('Product must have a name to be created as active', 'PUBLISH_MISSING_NAME');
      }
      if (!input.basePrice || input.basePrice <= 0) {
        throw AppError.badRequest('Product must have a valid base price to be created as active', 'PUBLISH_MISSING_BASE_PRICE');
      }
    }

    // Validate brand belongs to this store (by UUID lookup in the brands table)
    if (input.brand) {
      const brand = await Brand.findOne({ where: { id: input.brand, storeId } });
      if (!brand) {
        throw AppError.badRequest(
          `Brand not found in your store's brand list. Add it to your store first.`,
          'INVALID_BRAND',
        );
      }
    }

    const slug = await generateUniqueSlug(input.name ?? 'draft', Product);

    // Validate SKU uniqueness across all colour groups in the request
    if (input.colors?.length) {
      const allSkus = input.colors.flatMap((c) => c.variants?.map((v) => v.sku).filter(Boolean) || []);
      if (allSkus.length !== new Set(allSkus).size) {
        throw AppError.conflict('Duplicate SKUs found across different colour groups', 'SKU_CONFLICT');
      }
    }

    return sequelize.transaction(async (t: Transaction) => {
      const product = await Product.create(
        {
          storeId,
          name: input.name ?? '',
          slug,
          status: (input.status ?? 'draft') as 'draft' | 'active',
          description: input.description || null,
          brand: input.brand || null,
          gender: input.gender || null,
          categoryType: input.categoryType || null,
          categoryId: input.categoryId || null,
          subCategoryId: input.subCategoryId || null,
          basePrice: input.basePrice ?? 0,
          discountPercent: input.discountPercent ?? 0,
          discountStartDate: input.discountStartDate ? new Date(input.discountStartDate) : null,
          discountEndDate: input.discountEndDate ? new Date(input.discountEndDate) : null,
          lowStockThreshold: input.lowStockThreshold ?? 10,
          lowStockAlert: input.lowStockAlert ?? false,
          isActive: !isDraft,
        },
        { transaction: t },
      );

      const productId = product.get('id') as string;

      // Product-level images
      const images: ProductImage[] = [];
      if (input.images?.length) {
        const created = await ProductImage.bulkCreate(
          input.images.map((img, i) => ({
            productId,
            url: img.url,
            position: img.position ?? i,
          })),
          { transaction: t },
        );
        images.push(...created);
      }

      // Colour groups → images → size variants
      const colors: ReturnType<typeof serializeColor>[] = [];
      if (input.colors?.length) {
        for (const colorInput of input.colors) {
          const color = await ProductColor.create(
            { productId, colorName: colorInput.colorName, colorHex: colorInput.colorHex ?? null },
            { transaction: t },
          );

          const colorImages: ProductColorImage[] = [];
          if (colorInput.images?.length) {
            const createdImgs = await ProductColorImage.bulkCreate(
              colorInput.images.map((img, idx) => ({
                colorId: color.get('id'),
                imageUrl: img.imageUrl,
                altText: img.altText ?? null,
                displayOrder: img.displayOrder ?? idx,
              })),
              { transaction: t },
            );
            colorImages.push(...createdImgs);
          }

          const variants: ProductVariant[] = [];
          if (colorInput.variants?.length) {
            // Validate SKU uniqueness within the product before bulk-creating
            const incomingSkus = colorInput.variants.map((v) => v.sku).filter(Boolean);
            if (incomingSkus.length !== new Set(incomingSkus).size) {
              throw AppError.conflict('Duplicate SKUs within the same colour group', 'SKU_CONFLICT');
            }

            const createdVariants = await ProductVariant.bulkCreate(
              colorInput.variants.map((v) => ({
                productId,
                colorId: color.get('id'),
                size: v.size ?? null,
                sizeChart: normalizeSizeChartUrl(v.sizeChart),
                sku: v.sku || null, // Ensure empty strings are handled as NULL to avoid unique constraint issues
                stock: v.stock ?? 0,
                additionalPrice: v.additionalPrice ?? 0,
              })),
              { transaction: t },
            );
            variants.push(...createdVariants);
          }

          colors.push(serializeColor(color, colorImages, variants));
        }
      }

      await syncProductStockFromVariants(productId, t);

      return {
        ...product.toPublicJSON(),
        images: images.map((i) => i.toPublicJSON()),
        colors,
      };
    });
  }

  async update(
    productId: string,
    input: UpdateProductInput,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);
    await assertCategoryRefs(input.categoryId, input.subCategoryId);

    // Validate brand belongs to this store (by UUID lookup in the brands table)
    if (input.brand !== undefined && input.brand !== null && input.brand !== '') {
      const brand = await Brand.findOne({ where: { id: input.brand, storeId: product.storeId } });
      if (!brand) {
        throw AppError.badRequest(
          `Brand not found in your store's brand list. Add it to your store first.`,
          'INVALID_BRAND',
        );
      }
    }

    // Validate required fields when publishing via status change
    const visibilityPatch = resolveProductVisibilityPatch(product, input);

    const updateData: any = { ...input };
    if (updateData.categoryId === '') updateData.categoryId = null;
    if (updateData.subCategoryId === '') updateData.subCategoryId = null;
    if (updateData.brand === '') updateData.brand = null;
    if (updateData.description === '') updateData.description = null;
    if (updateData.gender === '') updateData.gender = null;
    if (updateData.categoryType === '') updateData.categoryType = null;
    if (input.discountStartDate !== undefined) {
      updateData.discountStartDate = input.discountStartDate ? new Date(input.discountStartDate) : null;
    }
    if (input.discountEndDate !== undefined) {
      updateData.discountEndDate = input.discountEndDate ? new Date(input.discountEndDate) : null;
    }

    Object.assign(updateData, visibilityPatch);

    await product.update(updateData);
    return this.findById(productId);
  }

  async fullUpdate(
    productId: string,
    input: FullUpdateProductInput,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);
    await assertCategoryRefs(input.categoryId, input.subCategoryId);

    // Validate SKU uniqueness across all colour groups in the request
    if (input.colors?.length) {
      const allSkus = input.colors.flatMap((c) => c.variants?.map((v) => v.sku).filter(Boolean) || []);
      if (allSkus.length !== new Set(allSkus).size) {
        throw AppError.conflict('Duplicate SKUs found across different colour groups', 'SKU_CONFLICT');
      }
    }

    // Validate brand belongs to this store (by UUID lookup in the brands table)
    if (input.brand) {
      const brand = await Brand.findOne({ where: { id: input.brand, storeId: product.storeId } });
      if (!brand) {
        throw AppError.badRequest(
          `Brand not found in your store's brand list. Add it to your store first.`,
          'INVALID_BRAND',
        );
      }
    }

    return sequelize.transaction(async (t: Transaction) => {
      const visibilityPatch = resolveProductVisibilityPatch(product, input);

      // 1. Update top-level product data + regenerate slug when name changes
      const updateData: any = {
        name: input.name,
        description: input.description || null,
        brand: input.brand || null,
        gender: input.gender || null,
        categoryType: input.categoryType || null,
        categoryId: input.categoryId || null,
        subCategoryId: input.subCategoryId || null,
        basePrice: input.basePrice,
        discountPercent: input.discountPercent ?? 0,
        discountStartDate: input.discountStartDate ? new Date(input.discountStartDate) : null,
        discountEndDate: input.discountEndDate ? new Date(input.discountEndDate) : null,
        lowStockThreshold: input.lowStockThreshold ?? 10,
        lowStockAlert: input.lowStockAlert ?? false,
        isActive: input.isActive ?? product.isActive,
        inStock: input.inStock ?? product.inStock,
        ...visibilityPatch,
      };

      if (input.name && input.name !== product.name) {
        updateData.slug = await generateUniqueSlug(input.name, Product);
      }

      await product.update(updateData, { transaction: t });

      // 2. Sync Product-level images (Replace all)
      await ProductImage.destroy({ where: { productId }, transaction: t });
      if (input.images?.length) {
        await ProductImage.bulkCreate(
          input.images.map((img, i) => ({
            productId,
            url: img.url,
            position: img.position ?? i,
          })),
          { transaction: t },
        );
      }

      // 3. Sync Colors & Variants (Replace all for safety/simplicity in PUT)
      // IMPORTANT: Destroy children first (variants, color images) before colors
      // to avoid FK constraint violations since there is no CASCADE delete.
      await ProductVariant.destroy({ where: { productId }, transaction: t });
      const existingColorIds = (
        await ProductColor.findAll({ where: { productId }, attributes: ['id'], transaction: t })
      ).map((c) => c.id);
      if (existingColorIds.length) {
        await ProductColorImage.destroy({ where: { colorId: existingColorIds }, transaction: t });
      }
      await ProductColor.destroy({ where: { productId }, transaction: t });

      if (input.colors?.length) {
        for (const colorInput of input.colors) {
          const color = await ProductColor.create(
            { productId, colorName: colorInput.colorName, colorHex: colorInput.colorHex ?? null },
            { transaction: t },
          );

          if (colorInput.images?.length) {
            await ProductColorImage.bulkCreate(
              colorInput.images.map((img, idx) => ({
                colorId: color.get('id'),
                imageUrl: img.imageUrl,
                altText: img.altText ?? null,
                displayOrder: img.displayOrder ?? idx,
              })),
              { transaction: t },
            );
          }

          if (colorInput.variants?.length) {
            await ProductVariant.bulkCreate(
              colorInput.variants.map((v) => ({
                productId,
                colorId: color.get('id'),
                size: v.size ?? null,
                sizeChart: normalizeSizeChartUrl(v.sizeChart),
                sku: v.sku || null, // Ensure empty strings are handled as NULL to avoid unique constraint issues
                stock: v.stock ?? 0,
                additionalPrice: v.additionalPrice ?? 0,
              })),
              { transaction: t },
            );
          }
        }
      }

      await syncProductStockFromVariants(productId, t);

      // Re-fetch the fully updated product within the same transaction
      // so the response reflects the committed data.
      const updated = await Product.findByPk(productId, {
        transaction: t,
        include: [
          { model: ProductImage, as: 'images' },
          { model: Category, as: 'category' },
          { model: SubCategory, as: 'subCategory' },
          { model: Brand, as: 'brandDetail' },
          {
            model: ProductColor,
            as: 'colors',
            include: [
              { model: ProductColorImage, as: 'images' },
              { model: ProductVariant, as: 'variants' },
            ],
          },
        ],
      });

      if (!updated) throw AppError.notFound('Product not found after update', 'PRODUCT_NOT_FOUND');

      type ColorWithAssocs = ProductColor & {
        images: ProductColorImage[];
        variants: ProductVariant[];
      };

      const res: any = {
        ...updated.toPublicJSON(),
        images: ((updated as any).images as ProductImage[] ?? []).map((i) => i.toPublicJSON()),
        colors: ((updated as any).colors as ColorWithAssocs[] ?? []).map((c) =>
          serializeColor(c, c.images ?? [], c.variants ?? []),
        ),
      };

      if ((updated as any).category) res.category = (updated as any).category.toPublicJSON();
      if ((updated as any).subCategory) res.subCategory = (updated as any).subCategory.toPublicJSON();
      if ((updated as any).brandDetail) res.brand = (updated as any).brandDetail.toPublicJSON();

      return res;
    });
  }

  async remove(productId: string, requesterId: string, isAdmin: boolean, hard = false) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    // Draft products are always hard-deleted since they were never published
    // and soft-delete (isActive=false) is a no-op for them.
    if ((hard && isAdmin) || product.status === 'draft') {
      await product.destroy();
    } else {
      await product.update({ isActive: false });
    }
  }

  async findBySlug(slug: string, currentUserId?: string) {
    const where: any = { slug, isActive: true, status: 'active' };
    const includes: any[] = [
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: SubCategory, as: 'subCategory' },
      { model: Brand, as: 'brandDetail' },
      {
        model: ProductColor,
        as: 'colors',
        include: [
          { model: ProductColorImage, as: 'images' },
          { model: ProductVariant, as: 'variants' },
        ],
      },
    ];

    if (currentUserId) {
      includes.push({
        model: Wishlist,
        as: 'wishlists',
        required: false,
        where: { userId: currentUserId },
        attributes: ['id'],
      });
    }

    const product = await Product.findOne({
      where,
      include: includes,
    });

    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    type ColorWithAssocs = ProductColor & {
      images: ProductColorImage[];
      variants: ProductVariant[];
    };

    const res: any = {
      ...product.toPublicJSON(),
      images: ((product as any).images as ProductImage[] ?? []).map((i) => i.toPublicJSON()),
      colors: ((product as any).colors as ColorWithAssocs[] ?? []).map((c) =>
        serializeColor(c, c.images ?? [], c.variants ?? []),
      ),
      isWishlisted: currentUserId ? ((product as any).wishlists as any[] ?? []).length > 0 : false,
    };

    if ((product as any).category) res.category = (product as any).category.toPublicJSON();
    if ((product as any).subCategory) res.subCategory = (product as any).subCategory.toPublicJSON();
    if ((product as any).brandDetail) res.brand = (product as any).brandDetail.toPublicJSON();

    return res;
  }

  async findById(productId: string, currentUserId?: string) {
    const includes: any[] = [
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: SubCategory, as: 'subCategory' },
      { model: Brand, as: 'brandDetail' },
      {
        model: ProductColor,
        as: 'colors',
        include: [
          { model: ProductColorImage, as: 'images' },
          { model: ProductVariant, as: 'variants' },
        ],
      },
    ];

    if (currentUserId) {
      includes.push({
        model: Wishlist,
        as: 'wishlists',
        required: false,
        where: { userId: currentUserId },
        attributes: ['id'],
      });
    }
    
    const product = await Product.findByPk(productId, {
      include: includes,
    });

    console.log(`DEBUG: findById(${productId}) - product found: ${!!product}, isActive: ${product?.isActive}`);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    type ColorWithAssocs = ProductColor & {
      images: ProductColorImage[];
      variants: ProductVariant[];
    };

    const res: any = {
      ...product.toPublicJSON(),
      images: ((product as any).images as ProductImage[] ?? []).map((i) => i.toPublicJSON()),
      colors: ((product as any).colors as ColorWithAssocs[] ?? []).map((c) =>
        serializeColor(c, c.images ?? [], c.variants ?? []),
      ),
      isWishlisted: currentUserId ? ((product as any).wishlists as any[] ?? []).length > 0 : false,
    };

    if ((product as any).category) res.category = (product as any).category.toPublicJSON();
    if ((product as any).subCategory) res.subCategory = (product as any).subCategory.toPublicJSON();
    if ((product as any).brandDetail) res.brand = (product as any).brandDetail.toPublicJSON();

    return res;
  }

  async publish(productId: string, requesterId: string, isAdmin: boolean) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    if (product.status === 'active') {
      throw AppError.badRequest('Product is already published', 'ALREADY_PUBLISHED');
    }
    assertProductPublishable(product.name, Number(product.basePrice));

    await product.update({ status: 'active', isActive: true });
    return this.findById(productId);
  }

  async listDrafts(input: ListDraftsInput, requesterId: string, isAdmin: boolean): Promise<PaginatedProducts> {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: any = { status: 'draft', isActive: false };

    if (isAdmin) {
      if (input.storeId) where.storeId = input.storeId;
    } else {
      const store = await Store.findOne({ where: { ownerId: requesterId } });
      if (!store) throw AppError.notFound('Store not found for this vendor', 'STORE_NOT_FOUND');
      where.storeId = store.id;
    }
    if (input.search) {
      where.name = { [Op.iLike]: `%${input.search}%` };
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
      include: [
        { model: ProductImage, as: 'images' },
        { model: Category, as: 'category' },
        { model: SubCategory, as: 'subCategory' },
        { model: Brand, as: 'brandDetail' },
      ],
    });

    return {
      items: rows.map((p) => {
        const res: any = {
          ...p.toPublicJSON(),
          images: ((p as any).images as ProductImage[] ?? []).map((i) => i.toPublicJSON()),
        };
        if ((p as any).category) res.category = (p as any).category.toPublicJSON();
        if ((p as any).subCategory) res.subCategory = (p as any).subCategory.toPublicJSON();
        if ((p as any).brandDetail) res.brand = (p as any).brandDetail.toPublicJSON();
        return res;
      }),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ── Color management ───────────────────────────────────────────────────────

  async addColor(
    productId: string,
    input: ColorInput,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    return sequelize.transaction(async (t: Transaction) => {
      const color = await ProductColor.create(
        { productId, colorName: input.colorName, colorHex: input.colorHex ?? null },
        { transaction: t },
      );

      const colorImages: ProductColorImage[] = [];
      if (input.images?.length) {
        const created = await ProductColorImage.bulkCreate(
          input.images.map((img, idx) => ({
            colorId: color.get('id') as string,
            imageUrl: img.imageUrl,
            altText: img.altText ?? null,
            displayOrder: img.displayOrder ?? idx,
          })),
          { transaction: t },
        );
        colorImages.push(...created);
      }

      const variants: ProductVariant[] = [];
      if (input.variants?.length) {
        const created = await ProductVariant.bulkCreate(
          input.variants.map((v) => ({
            productId,
            colorId: color.get('id') as string,
            size: v.size ?? null,
            sizeChart: normalizeSizeChartUrl(v.sizeChart),
            sku: v.sku ?? null,
            stock: v.stock ?? 0,
            additionalPrice: v.additionalPrice ?? 0,
          })),
          { transaction: t },
        );
        variants.push(...created);
      }

      await syncProductStockFromVariants(productId, t);

      return serializeColor(color, colorImages, variants);
    });
  }

  async updateColor(
    productId: string,
    colorId: string,
    input: UpdateColorInput,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const color = await ProductColor.findOne({ where: { id: colorId, productId } });
    if (!color) throw AppError.notFound('Color not found', 'COLOR_NOT_FOUND');

    await color.update(input);

    const images = await ProductColorImage.findAll({ where: { colorId } });
    const variants = await ProductVariant.findAll({ where: { colorId } });

    return serializeColor(color, images, variants);
  }

  async removeColor(
    productId: string,
    colorId: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const color = await ProductColor.findOne({ where: { id: colorId, productId } });
    if (!color) throw AppError.notFound('Color not found', 'COLOR_NOT_FOUND');

    // CASCADE delete handles ProductColorImage and ProductVariant rows
    await color.destroy();
  }

  // ── Color image management ─────────────────────────────────────────────────

  async addColorImage(
    productId: string,
    colorId: string,
    input: ColorImageInput,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const color = await ProductColor.findOne({ where: { id: colorId, productId } });
    if (!color) throw AppError.notFound('Color not found', 'COLOR_NOT_FOUND');

    const image = await ProductColorImage.create({
      colorId,
      imageUrl: input.imageUrl,
      altText: input.altText ?? null,
      displayOrder: input.displayOrder ?? 0,
    });

    return image.toPublicJSON();
  }

  async removeColorImage(
    productId: string,
    colorId: string,
    imageId: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const color = await ProductColor.findOne({ where: { id: colorId, productId } });
    if (!color) throw AppError.notFound('Color not found', 'COLOR_NOT_FOUND');

    const image = await ProductColorImage.findOne({ where: { id: imageId, colorId } });
    if (!image) throw AppError.notFound('Image not found', 'IMAGE_NOT_FOUND');

    await image.destroy();
  }

  // ── Variant (SKU) management ───────────────────────────────────────────────

  async addVariant(
    productId: string,
    colorId: string,
    input: VariantInput,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const color = await ProductColor.findOne({ where: { id: colorId, productId } });
    if (!color) throw AppError.notFound('Color not found', 'COLOR_NOT_FOUND');

    if (input.sku) {
      const existing = await ProductVariant.findOne({ where: { productId, sku: input.sku } });
      if (existing) throw AppError.conflict('SKU already exists for this product', 'SKU_CONFLICT');
    }

    const variant = await ProductVariant.create({
      productId,
      colorId,
      size: input.size ?? null,
      sizeChart: normalizeSizeChartUrl(input.sizeChart),
      sku: input.sku ?? null,
      stock: input.stock ?? 0,
      additionalPrice: input.additionalPrice ?? 0,
    });

    await syncProductStockFromVariants(productId);

    return variant.toPublicJSON();
  }

  async updateVariant(
    productId: string,
    colorId: string,
    variantId: string,
    input: UpdateVariantInput,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const color = await ProductColor.findOne({ where: { id: colorId, productId } });
    if (!color) throw AppError.notFound('Color not found', 'COLOR_NOT_FOUND');

    const variant = await ProductVariant.findOne({ where: { id: variantId, colorId, productId } });
    if (!variant) throw AppError.notFound('Variant not found', 'VARIANT_NOT_FOUND');

    if (input.sku && input.sku !== variant.sku) {
      const conflict = await ProductVariant.findOne({ where: { productId, sku: input.sku } });
      if (conflict) throw AppError.conflict('SKU already exists for this product', 'SKU_CONFLICT');
    }

    const previousStock = variant.stock;
    const updatePayload = {
      ...input,
      ...(input.sizeChart !== undefined ? { sizeChart: normalizeSizeChartUrl(input.sizeChart) } : {}),
    };
    await variant.update(updatePayload);

    await syncProductStockFromVariants(productId);

    if (input.stock !== undefined && input.stock !== previousStock) {
      await maybeNotifyVendorStockChange(product, previousStock, input.stock);
    }

    return variant.toPublicJSON();
  }

  async removeVariant(
    productId: string,
    colorId: string,
    variantId: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const color = await ProductColor.findOne({ where: { id: colorId, productId } });
    if (!color) throw AppError.notFound('Color not found', 'COLOR_NOT_FOUND');

    const variant = await ProductVariant.findOne({ where: { id: variantId, colorId, productId } });
    if (!variant) throw AppError.notFound('Variant not found', 'VARIANT_NOT_FOUND');

    await variant.destroy();
    await syncProductStockFromVariants(productId);
  }

  // ── Product-level image management ────────────────────────────────────────

  async addImage(
    productId: string,
    url: string,
    position: number,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const image = await ProductImage.create({ productId, url, position });
    return image.toPublicJSON();
  }

  async removeImage(
    productId: string,
    imageId: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const product = await Product.findByPk(productId);
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    await assertStoreOwnership(product.storeId, requesterId, isAdmin);

    const image = await ProductImage.findOne({ where: { id: imageId, productId } });
    if (!image) throw AppError.notFound('Image not found', 'IMAGE_NOT_FOUND');

    await image.destroy();
  }
}

export default new ProductService();
