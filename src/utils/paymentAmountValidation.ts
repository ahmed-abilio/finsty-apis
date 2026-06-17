import Order from '@modules/order/order.model';
import { resolveDeliveryWaivedReason } from '@config/delivery.config';

export interface AmountMismatchContext {
  clientAmount: number;
  suggestedAmount: number;
  orderTotal: number;
  deliveryCharge: number;
  subtotal: number;
  useWallet: boolean;
  walletAmount?: number;
  deliveryWaivedReason: ReturnType<typeof resolveDeliveryWaivedReason>;
  hint: string;
}

export function buildAmountMismatchContext(params: {
  order: Order;
  clientAmount: number;
  suggestedAmount: number;
  useWallet: boolean;
  walletAmount?: number;
}): AmountMismatchContext {
  const { order, clientAmount, suggestedAmount, useWallet, walletAmount } = params;
  const orderTotal = parseFloat(Number(order.totalAmount).toFixed(2));
  const deliveryCharge = parseFloat(Number(order.deliveryCharge).toFixed(2));
  const subtotal = parseFloat(Number(order.subtotal).toFixed(2));
  const deliveryWaivedReason = resolveDeliveryWaivedReason({
    deliveryType: order.deliveryType,
    deliveryCharge,
    couponCode: order.couponCode,
  });

  const clientDelta = parseFloat((clientAmount - suggestedAmount).toFixed(2));
  let hint: string;

  if (useWallet) {
    hint =
      'For partial wallet payments, send the Razorpay portion (order total minus wallet applied), not the checkout screen grand total.';
  } else if (deliveryWaivedReason === 'free_delivery_coupon' && clientDelta > 0) {
    hint =
      'Delivery is waived by coupon on this order. Use order.totalAmount from GET /orders/:id; do not add the Shadowfax quote.';
  } else if (deliveryCharge === 0 && clientDelta > 0) {
    hint = 'Delivery fee is waived on this order. Use order.totalAmount from GET /orders/:id.';
  } else if (clientDelta > 0) {
    hint =
      'Use order.totalAmount from GET /orders/:id or estimatedPayableTotal from GET /cart/delivery-quote; do not add delivery separately if already included.';
  } else {
    hint = 'Refresh checkout and use the server order total for payment.';
  }

  return {
    clientAmount,
    suggestedAmount,
    orderTotal,
    deliveryCharge,
    subtotal,
    useWallet,
    walletAmount,
    deliveryWaivedReason,
    hint,
  };
}
