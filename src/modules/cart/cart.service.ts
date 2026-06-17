import { IncludeOptions } from 'sequelize';
import Cart from './cart.model';
import CartItem from './cart-item.model';
import Product from '@modules/product/product.model';
import ProductVariant from '@modules/product/product-variant.model';
import ProductImage from '@modules/product/product-image.model';
import ProductColor from '@modules/product/product-color.model';
import ProductColorImage from '@modules/product/product-color-image.model';
import { AppError } from '@utils/appError';
import { Store } from '@config/associations';
import { computeLineItemPrice } from './pricing';
import { computeTaxOnSubtotal, getPlatformFee, getTaxRate } from '@config/pricing.config';
import { getPublicDeliveryConfig } from '@config/delivery.config';
import { resolveDeliveryQuote } from '@modules/delivery/deliveryQuote.service';

const INCLUDE_CART_ITEMS: IncludeOptions[] = [
  {
    model: CartItem,
    as: 'items',
    include: [
      {
        model: Product,
        as: 'product',
        include: [
          {
            // `separate: true` is required: limit/order on a hasMany include
            // collapses the outer query and returns at most ONE image total
            // across all cart items without it.
            model: ProductImage,
            as: 'images',
            separate: true,
            order: [['position', 'ASC']] as [string, string][],
            limit: 1,
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'latitude', 'longitude'],
            required: false,
          },
        ],
      },
      {
        model: ProductVariant,
        as: 'variant',
        required: false,
        include: [
          {
            model: ProductColor,
            as: 'color',
            // `id` is required: `separate: true` on nested images issues WHERE color_id IN (...)
            // using parent PKs; omitting `id` leaves them undefined and breaks the query.
            attributes: ['id', 'colorName', 'colorHex'],
            required: false,
            include: [
              {
                model: ProductColorImage,
                as: 'images',
                separate: true,
                order: [['displayOrder', 'ASC']] as [string, string][],
                limit: 1,
              },
            ],
          },
        ],
      },
    ],
  },
];


export interface AddToCartInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface SelectCartItemInput {
  isSelected: boolean;
}

class CartService {
  /** Get or lazily create a cart for the user */
  private async getOrCreateCart(userId: string): Promise<Cart> {
    const [cart] = await Cart.findOrCreate({ where: { userId }, defaults: { userId } });
    return cart;
  }

  async getCart(userId: string, page = 1, limit = 10, storeId?: string) {
    const cart = await Cart.findOne({ where: { userId }, include: INCLUDE_CART_ITEMS });
    if (!cart) {
      return {
        items: [],
        subtotal: 0,
        taxRate: getTaxRate(),
        taxAmount: 0,
        platformFee: 0,
        itemCount: 0,
        totalItems: 0,
        deliveryConfig: getPublicDeliveryConfig(),
        pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false },
      };
    }

    const formatted = this.formatCart(cart, storeId);
    const total = formatted.items.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    return {
      ...formatted,
      items: formatted.items.slice(offset, offset + limit),
      pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages },
    };
  }

  async addItem(userId: string, input: AddToCartInput) {
    const { productId, variantId, quantity } = input;

    // Validate product exists and is active
    const product = await Product.findOne({ where: { id: productId, isActive: true, inStock: true } });
    if (!product) throw AppError.notFound('Product not found or out of stock', 'PRODUCT_NOT_FOUND');

    // Validate variant if provided
    if (variantId) {
      const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
      if (!variant) throw AppError.notFound('Variant not found', 'VARIANT_NOT_FOUND');
      if (variant.stock < quantity)
        throw AppError.badRequest(
          `Only ${variant.stock} units available`,
          'INSUFFICIENT_STOCK',
        );
    } else {
      // If no variantId is provided, check if the product actually has variants
      const variantCount = await ProductVariant.count({ where: { productId } });
      if (variantCount > 0) {
        throw AppError.badRequest('Please select a variant for this product', 'VARIANT_REQUIRED');
      }
    }

    const cart = await this.getOrCreateCart(userId);

    // If same product+variant already in cart, update quantity instead
    const existing = await CartItem.findOne({
      where: { cartId: cart.id, productId, variantId: variantId ?? null },
    });

    if (existing) {
      existing.quantity += quantity;
      await existing.save();
    } else {
      await CartItem.create({ cartId: cart.id, productId, variantId: variantId ?? null, quantity });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) throw AppError.notFound('Cart not found', 'CART_NOT_FOUND');

    const item = await CartItem.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw AppError.notFound('Cart item not found', 'CART_ITEM_NOT_FOUND');

    if (quantity <= 0) {
      await item.destroy();
    } else {
      // Validate stock if variant
      if (item.variantId) {
        const variant = await ProductVariant.findByPk(item.variantId);
        if (variant && variant.stock < quantity) {
          throw AppError.badRequest(`Only ${variant.stock} units available`, 'INSUFFICIENT_STOCK');
        }
      }
      item.quantity = quantity;
      await item.save();
    }

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) throw AppError.notFound('Cart not found', 'CART_NOT_FOUND');

    const item = await CartItem.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw AppError.notFound('Cart item not found', 'CART_ITEM_NOT_FOUND');

    await item.destroy();
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await Cart.findOne({ where: { userId } });
    if (cart) await CartItem.destroy({ where: { cartId: cart.id } });
    return {
      items: [],
      subtotal: 0,
      taxRate: getTaxRate(),
      taxAmount: 0,
      platformFee: 0,
      itemCount: 0,
      totalItems: 0,
      deliveryConfig: getPublicDeliveryConfig(),
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false },
    };
  }

  formatCart(cart: Cart, storeId?: string) {
    const allItems = (cart as unknown as { items: CartItem[] }).items ?? [];
    
    // Filter by storeId if provided
    const items = storeId 
      ? allItems.filter(item => {
          const product = (item as any).product;
          return product && product.storeId === storeId;
        })
      : allItems;

    let subtotal = 0;
    let itemCount = 0;
    let totalItems = 0;

    const formattedItems = items.map((item) => {
      const product = (item as unknown as { product: Product }).product;
      const variant = (item as unknown as { variant: ProductVariant | null }).variant;
      const images = ((product as unknown as { images: ProductImage[] }).images ?? []).map(
        (i) => i.toPublicJSON(),
      );

      const pricing = computeLineItemPrice(product, variant, item.quantity);

      totalItems += item.quantity;

      // Only selected items count toward the checkout subtotal
      if (item.isSelected) {
        subtotal += pricing.itemTotal;
        itemCount += item.quantity;
      }

      const storeRaw = (product as unknown as { store: Store | null }).store ?? null;
      const store = storeRaw
        ? {
            id: storeRaw.id,
            name: storeRaw.name,
            latitude: Number(storeRaw.latitude),
            longitude: Number(storeRaw.longitude),
          }
        : null;
      const categoryId = product.categoryId ?? null;
      const subCategoryId = product.subCategoryId ?? null;
      const variantColor = variant
        ? ((variant as unknown as { color?: ProductColor | null }).color ?? null)
        : null;

      let variantImageUrl: string | null = null;
      let variantImage: ReturnType<ProductColorImage['toPublicJSON']> | null = null;
      if (variant) {
        const colorImages =
          (variant as unknown as { color?: { images?: ProductColorImage[] } }).color?.images ?? [];
        if (colorImages.length > 0) {
          const sorted = [...colorImages].sort(
            (a, b) => Number(a.displayOrder) - Number(b.displayOrder),
          );
          const first = sorted[0];
          variantImageUrl = first.imageUrl ? String(first.imageUrl) : null;
          variantImage = first.toPublicJSON();
        } else if (images.length > 0 && images[0].url) {
          variantImageUrl = String(images[0].url);
        }
      }

      const variantJson = variant
        ? {
            ...variant.toPublicJSON(),
            imageUrl: variantImageUrl,
            image: variantImage,
            color: variantColor?.colorName ?? null,
            colorHex: variantColor?.colorHex ?? null,
          }
        : null;

      const productJson = product.toPublicJSON();
      const discountStartDate = productJson.discountStartDate ?? null;
      const discountEndDate = productJson.discountEndDate ?? null;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        isSelected: item.isSelected,
        product: {
          ...productJson,
          discountStartDate,
          discountEndDate,
          images,
          store,
          category: categoryId ? { id: categoryId } : null,
          subcategory: subCategoryId ? { id: subCategoryId } : null,
        },
        variant: variantJson,
        basePrice: pricing.basePrice,
        discountPercent: pricing.discountPercent,
        discountStartDate,
        discountEndDate,
        discountAmount: pricing.discountAmount,
        discountedBasePrice: pricing.discountedBasePrice,
        additionalPrice: pricing.additionalPrice,
        unitPrice: pricing.unitPrice,
        itemTotal: pricing.itemTotal,
        baseTotal: pricing.baseTotal,
      };
    });

    const subtotalRounded = parseFloat(subtotal.toFixed(2));
    const taxRate = getTaxRate();
    const taxAmount = computeTaxOnSubtotal(subtotalRounded);
    const platformFee = getPlatformFee();
    return {
      items: formattedItems,
      subtotal: subtotalRounded,
      taxRate,
      taxAmount,
      platformFee,
      itemCount,
      totalItems,
      deliveryConfig: getPublicDeliveryConfig(),
    };
  }

  async selectItem(userId: string, itemId: string, isSelected: boolean) {
    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) throw AppError.notFound('Cart not found', 'CART_NOT_FOUND');

    const item = await CartItem.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw AppError.notFound('Cart item not found', 'CART_ITEM_NOT_FOUND');

    item.isSelected = isSelected;
    await item.save();

    return this.getCart(userId);
  }

  /** Used by order service — returns only selected cart items for order creation */
  async getCartForOrder(userId: string) {
    const INCLUDE_SELECTED_CART_ITEMS: IncludeOptions[] = [
      {
        model: CartItem,
        as: 'items',
        where: { isSelected: true },
        include: [
          {
            model: Product,
            as: 'product',
            include: [
              {
                model: ProductImage,
                as: 'images',
                separate: true,
                order: [['position', 'ASC']] as [string, string][],
                limit: 1,
              },
            ],
          },
          {
            model: ProductVariant,
            as: 'variant',
            required: false,
            include: [
              {
                model: ProductColor,
                as: 'color',
                attributes: ['id', 'colorName', 'colorHex'],
                required: false,
                include: [
                  {
                    model: ProductColorImage,
                    as: 'images',
                    separate: true,
                    order: [['displayOrder', 'ASC']] as [string, string][],
                    limit: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const cart = await Cart.findOne({ where: { userId }, include: INCLUDE_SELECTED_CART_ITEMS });
    if (!cart) return null;
    const items = (cart as unknown as { items: CartItem[] }).items ?? [];
    if (items.length === 0) return null;

    const storeIds = new Set(
      items
        .map((item) => (item as CartItem & { product?: Product }).product?.storeId)
        .filter((id): id is string => Boolean(id)),
    );
    if (storeIds.size !== 1) {
      throw AppError.badRequest(
        'Select all the products from same store for checkout',
        'MULTI_STORE_CHECKOUT',
      );
    }

    return { cart, formatted: this.formatCart(cart) };
  }

  /**
   * Live Shadowfax delivery quote for checkout using the user's default address
   * (or optional `addressId`) and selected cart items from a single store.
   */
  async getDeliveryQuote(userId: string, addressId?: string) {
    const cartData = await this.getCartForOrder(userId);
    if (!cartData) throw AppError.badRequest('Cart is empty', 'EMPTY_CART');

    const { cart, formatted } = cartData;
    const firstItem = formatted.items[0] as { product?: { storeId?: string } } | undefined;
    const storeId = firstItem?.product?.storeId;
    if (!storeId) {
      throw AppError.badRequest('Could not resolve store for delivery quote', 'STORE_NOT_FOUND');
    }

    return resolveDeliveryQuote({
      userId,
      subtotal: formatted.subtotal,
      storeId,
      addressId,
      cartId: cart.id,
    });
  }
}

export default new CartService();
