import { IncludeOptions } from 'sequelize';
import Cart from './cart.model';
import CartItem from './cart-item.model';
import Product from '@modules/product/product.model';
import ProductVariant from '@modules/product/product-variant.model';
import ProductImage from '@modules/product/product-image.model';
import { AppError } from '@utils/appError';
import { Store } from '@config/associations';

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
            model: ProductImage,
            as: 'images',
            order: [['position', 'ASC']] as [string, string][],
            limit: 1,
          },
          {
            model:Store,
            as:'store',
             attributes: ['id', 'name'],
             required: false,
          }
        ],
      },
      { model: ProductVariant, as: 'variant', required: false },
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
      return { items: [], subtotal: 0, itemCount: 0, totalItems: 0, pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false } };
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
    return { items: [], subtotal: 0, itemCount: 0 };
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

      const basePrice = Number(product.basePrice);
      const discountPercent = Number(product.discountPercent);
      const additionalPrice = variant ? Number(variant.additionalPrice) : 0;
      const unitPrice = parseFloat(
        (basePrice * (1 - discountPercent / 100) + additionalPrice).toFixed(2),
      );
      const itemTotal = parseFloat((unitPrice * item.quantity).toFixed(2));

      totalItems += item.quantity;

      // Only selected items count toward the checkout subtotal
      if (item.isSelected) {
        subtotal += itemTotal;
        itemCount += item.quantity;
      }

      const store = (product as unknown as { store: { id: string; name: string } | null }).store ?? null;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        isSelected: item.isSelected,
        product: { ...product.toPublicJSON(), images, store },
        variant: variant ? variant.toPublicJSON() : null,
        unitPrice,
        itemTotal,
      };
    });

    return {
      items: formattedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      itemCount,
      totalItems,
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
                order: [['position', 'ASC']] as [string, string][],
                limit: 1,
              },
            ],
          },
          { model: ProductVariant, as: 'variant', required: false },
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
}

export default new CartService();
