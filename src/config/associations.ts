/**
 * Central associations file.
 * Import this once in server.ts BEFORE sequelize.sync() / any query runs.
 * All models are imported here to avoid circular-dependency issues.
 */
import User from '@modules/user/user.model';
import Address from '@modules/address/address.model';
import Store from '@modules/store/store.model';
import Product from '@modules/product/product.model';
import ProductImage from '@modules/product/product-image.model';
import ProductColor from '@modules/product/product-color.model';
import ProductColorImage from '@modules/product/product-color-image.model';
import ProductVariant from '@modules/product/product-variant.model';
import ProductReview from '@modules/product/product-review.model';
import ProductReviewImage from '@modules/product/product-review-image.model';
import Cart from '@modules/cart/cart.model';
import CartItem from '@modules/cart/cart-item.model';
import Order from '@modules/order/order.model';
import OrderItem from '@modules/order/order-item.model';
import PendingOrder from '@modules/order/pending-order.model';
import Wishlist from '@modules/wishlist/wishlist.model';
import StoreReview from '@modules/store/store-review.model';
import StoreReviewImage from '@modules/store/store-review-image.model';
import Wallet from '@modules/wallet/wallet.model';
import WalletTransaction from '@modules/wallet/wallet-transaction.model';
import Payment from '@modules/payment/payment.model';
import Coupon from '@modules/coupon/coupon.model';
import CouponUsage from '@modules/coupon/coupon-usage.model';
import Brand from '@modules/brand/brand.model';
import Category from '@modules/category/category.model';
import SubCategory from '@modules/sub-category/sub-category.model';
import ShadowfaxShipment from '@modules/shadowfax/shadowfax-shipment.model';
import OrderStatusHistory from '@modules/shadowfax/tracking/order-status-history.model';
import ShadowfaxWebhookEvent from '@modules/shadowfax/tracking/shadowfax-webhook-event.model';
import OrderRiderLocation from '@modules/shadowfax/tracking/order-rider-location.model';
import DeviceToken from '@modules/notification/device-token.model';
import NotificationInbox from '@modules/notification/notification-inbox.model';
import CmsPage from '@modules/cms/cms.model';

// ─── User ↔ DeviceToken (push) ────────────────────────────────────────────────
User.hasMany(DeviceToken, { foreignKey: 'userId', as: 'deviceTokens' });
DeviceToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── User ↔ Notification inbox ───────────────────────────────────────────────
User.hasMany(NotificationInbox, { foreignKey: 'userId', as: 'notifications' });
NotificationInbox.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── User ↔ Address ───────────────────────────────────────────────────────────
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── User ↔ Cart ──────────────────────────────────────────────────────────────
User.hasOne(Cart, { foreignKey: 'userId', as: 'cart' });
Cart.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── User ↔ Order ─────────────────────────────────────────────────────────────
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── User ↔ PendingOrder ──────────────────────────────────────────────────────
User.hasMany(PendingOrder, { foreignKey: 'userId', as: 'pendingOrders' });
PendingOrder.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── Store ↔ Product ──────────────────────────────────────────────────────────
Store.hasMany(Product, { foreignKey: 'storeId', as: 'products' });
Product.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

// ─── Product ↔ Category / SubCategory / Brand ────────────────────────────────
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Product.belongsTo(SubCategory, { foreignKey: 'subCategoryId', as: 'subCategory' });
Product.belongsTo(Brand, { foreignKey: 'brand', as: 'brandDetail', constraints: false });


// ─── Product ↔ ProductImage ───────────────────────────────────────────────────
Product.hasMany(ProductImage, { foreignKey: 'productId', as: 'images' });
ProductImage.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── Product ↔ ProductReview ──────────────────────────────────────────────────
Product.hasMany(ProductReview, { foreignKey: 'productId', as: 'reviews' });
ProductReview.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── User ↔ ProductReview ─────────────────────────────────────────────────────
User.hasMany(ProductReview, { foreignKey: 'userId', as: 'reviews' });
ProductReview.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── ProductReview ↔ ProductReviewImage ───────────────────────────────────────
ProductReview.hasMany(ProductReviewImage, { foreignKey: 'reviewId', as: 'images' });
ProductReviewImage.belongsTo(ProductReview, { foreignKey: 'reviewId', as: 'review' });

// ─── Product ↔ ProductColor ───────────────────────────────────────────────────
Product.hasMany(ProductColor, { foreignKey: 'productId', as: 'colors' });
ProductColor.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── ProductColor ↔ ProductColorImage ────────────────────────────────────────
ProductColor.hasMany(ProductColorImage, { foreignKey: 'colorId', as: 'images' });
ProductColorImage.belongsTo(ProductColor, { foreignKey: 'colorId', as: 'color' });

// ─── ProductColor ↔ ProductVariant ───────────────────────────────────────────
ProductColor.hasMany(ProductVariant, { foreignKey: 'colorId', as: 'variants' });
ProductVariant.belongsTo(ProductColor, { foreignKey: 'colorId', as: 'color' });

// ─── Product ↔ ProductVariant (direct, for cart/order FK lookups) ─────────────
Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── Cart ↔ CartItem ──────────────────────────────────────────────────────────
Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'items' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId', as: 'cart' });

// ─── CartItem ↔ Product / ProductVariant ─────────────────────────────────────
CartItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
CartItem.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });

// ─── Order ↔ OrderItem ────────────────────────────────────────────────────────
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// ─── Order ↔ Address ──────────────────────────────────────────────────────────
Order.belongsTo(Address, { foreignKey: 'addressId', as: 'address' });

// ─── Order ↔ ShadowfaxShipment ───────────────────────────────────────────────
Order.hasOne(ShadowfaxShipment, { foreignKey: 'orderId', as: 'shadowfaxShipment' });
ShadowfaxShipment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasMany(OrderStatusHistory, { foreignKey: 'orderId', as: 'statusHistory' });
OrderStatusHistory.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasMany(OrderRiderLocation, { foreignKey: 'orderId', as: 'riderLocations' });
OrderRiderLocation.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// ─── OrderItem ↔ Product / ProductVariant ────────────────────────────────────
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
OrderItem.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });

// ─── Store ↔ StoreReview ──────────────────────────────────────────────────────
Store.hasMany(StoreReview, { foreignKey: 'storeId', as: 'storeReviews' });
StoreReview.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

// ─── User ↔ StoreReview ───────────────────────────────────────────────────────
User.hasMany(StoreReview, { foreignKey: 'userId', as: 'storeReviews' });
StoreReview.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── StoreReview ↔ StoreReviewImage ──────────────────────────────────────────
StoreReview.hasMany(StoreReviewImage, { foreignKey: 'reviewId', as: 'images' });
StoreReviewImage.belongsTo(StoreReview, { foreignKey: 'reviewId', as: 'review' });

// ─── User ↔ Wishlist ──────────────────────────────────────────────────────────
User.hasMany(Wishlist, { foreignKey: 'userId', as: 'wishlists' });
Wishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── Wishlist ↔ Product ───────────────────────────────────────────────────────
Wishlist.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(Wishlist, { foreignKey: 'productId', as: 'wishlists' });

// ─── User ↔ Wallet ────────────────────────────────────────────────────────────
User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── Wallet ↔ WalletTransaction ───────────────────────────────────────────────
Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

// ─── Payment associations ─────────────────────────────────────────────────────
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Order.hasMany(Payment, { foreignKey: 'orderId', as: 'payments' });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Wallet.hasMany(Payment, { foreignKey: 'walletId', as: 'payments' });
Payment.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

// ─── User self-referential (referral) ─────────────────────────────────────────
User.belongsTo(User, { foreignKey: 'referredById', as: 'referredBy' });
User.hasMany(User, { foreignKey: 'referredById', as: 'referrals' });

// ─── Coupon ↔ CouponUsage ─────────────────────────────────────────────────────
Coupon.hasMany(CouponUsage, { foreignKey: 'couponId', as: 'usages' });
CouponUsage.belongsTo(Coupon, { foreignKey: 'couponId', as: 'coupon' });

// ─── User ↔ CouponUsage ───────────────────────────────────────────────────────
User.hasMany(CouponUsage, { foreignKey: 'userId', as: 'couponUsages' });
CouponUsage.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── Order ↔ CouponUsage ──────────────────────────────────────────────────────
Order.hasMany(CouponUsage, { foreignKey: 'orderId', as: 'couponUsages' });
CouponUsage.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// ─── Coupon ↔ Store / Category (optional FK) ─────────────────────────────────
Coupon.belongsTo(Store, { foreignKey: 'storeId', as: 'store', constraints: false });
Store.hasMany(Coupon, { foreignKey: 'storeId', as: 'coupons', constraints: false });

export {
  User,
  Address,
  Store,
  Brand,
  Category,
  SubCategory,
  Product,
  ProductImage,
  ProductColor,
  ProductColorImage,
  ProductVariant,
  ProductReview,
  ProductReviewImage,
  Cart,
  CartItem,
  Order,
  OrderItem,
  PendingOrder,
  Wishlist,
  StoreReview,
  StoreReviewImage,
  Wallet,
  WalletTransaction,
  Payment,
  Coupon,
  CouponUsage,
  ShadowfaxShipment,
  OrderStatusHistory,
  ShadowfaxWebhookEvent,
  OrderRiderLocation,
  DeviceToken,
  NotificationInbox,
  CmsPage,
};
