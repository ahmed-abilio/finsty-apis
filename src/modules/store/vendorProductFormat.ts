import Product from '@modules/product/product.model';
import ProductImage from '@modules/product/product-image.model';
import ProductColor from '@modules/product/product-color.model';
import ProductColorImage from '@modules/product/product-color-image.model';
import ProductVariant from '@modules/product/product-variant.model';
import Category from '@modules/category/category.model';
import SubCategory from '@modules/sub-category/sub-category.model';
import Brand from '@modules/brand/brand.model';

export type ProductWithVendorAssocs = Product & {
  images?: ProductImage[];
  colors?: Array<
    ProductColor & {
      images?: ProductColorImage[];
      variants?: ProductVariant[];
    }
  >;
  category?: Category;
  subCategory?: SubCategory;
  brandDetail?: Brand;
};

/** Full vendor catalog product shape (matches GET /stores/my/products items). */
export function formatVendorProduct(product: ProductWithVendorAssocs): Record<string, unknown> {
  const { categoryId, subCategoryId, brand: _b, ...rest } = product.toPublicJSON();
  return {
    ...rest,
    category: product.category ? product.category.toPublicJSON() : null,
    subCategory: product.subCategory ? product.subCategory.toPublicJSON() : null,
    brand: product.brandDetail ? product.brandDetail.toPublicJSON() : null,
    images: (product.images ?? []).map((i) => i.toPublicJSON()),
    colors: (product.colors ?? []).map((c) => ({
      ...c.toPublicJSON(),
      images: (c.images ?? []).map((img) => img.toPublicJSON()),
      variants: (c.variants ?? []).map((v) => v.toPublicJSON()),
    })),
  };
}

export const vendorProductIncludes = [
  { model: ProductImage, as: 'images', separate: true, order: [['position', 'ASC']] },
  {
    model: ProductColor,
    as: 'colors',
    separate: true,
    include: [
      {
        model: ProductColorImage,
        as: 'images',
        separate: true,
        order: [['displayOrder', 'ASC']],
      },
      { model: ProductVariant, as: 'variants', separate: true },
    ],
  },
  { model: Category, as: 'category' },
  { model: SubCategory, as: 'subCategory' },
  { model: Brand, as: 'brandDetail' },
];
