import Product from '@modules/product/product.model';
import Store from '@modules/store/store.model';
import { NotificationType } from './notification.types';
import { notifyVendor } from './notification.service';

export async function maybeNotifyVendorStockChange(
  product: Product,
  previousStock: number,
  newStock: number,
): Promise<void> {
  if (previousStock === newStock) return;

  const store = await Store.findByPk(product.storeId, { attributes: ['ownerId'] });
  if (!store?.ownerId) return;

  const threshold = Number(product.lowStockThreshold ?? 10);
  const productName = product.name ?? 'Product';
  const context = {
    productId: product.id,
    productName,
    stock: newStock,
  };

  if (newStock === 0 && previousStock > 0) {
    notifyVendor(store.ownerId, NotificationType.VENDOR_OUT_OF_STOCK, context);
    return;
  }

  if (newStock <= threshold && previousStock > threshold) {
    notifyVendor(store.ownerId, NotificationType.VENDOR_LOW_STOCK, context);
  }
}
