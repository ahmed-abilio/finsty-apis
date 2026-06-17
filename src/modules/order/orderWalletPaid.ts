import { Op } from 'sequelize';
import WalletTransaction from '@modules/wallet/wallet-transaction.model';

type PaymentLike = {
  status: string;
  amount?: number;
  metadata?: object | null;
};

/** Wallet debits recorded at payment time (`wallet_pay_order_*` or `order_*` references). */
export async function buildWalletPaidByOrderIds(orderIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!orderIds.length) return map;

  for (const id of orderIds) {
    map.set(id, 0);
  }

  const references = orderIds.flatMap((id) => [`wallet_pay_order_${id}`, `order_${id}`]);

  const transactions = await WalletTransaction.findAll({
    where: {
      type: 'debit',
      source: 'order_payment',
      status: 'successful',
      reference: { [Op.in]: references },
    },
    attributes: ['reference', 'amount'],
  });

  for (const tx of transactions) {
    const orderId = orderIdFromWalletReference(tx.reference);
    if (!orderId || !map.has(orderId)) continue;
    const next = parseFloat((map.get(orderId)! + Number(tx.amount)).toFixed(2));
    map.set(orderId, next);
  }

  return map;
}

export function orderIdFromWalletReference(reference: string): string | null {
  if (reference.startsWith('wallet_pay_order_')) {
    return reference.slice('wallet_pay_order_'.length);
  }
  if (reference.startsWith('order_')) {
    return reference.slice('order_'.length);
  }
  return null;
}

/**
 * Fallback when wallet transactions are not preloaded (e.g. right after pay-wallet in same request).
 * Uses captured payment metadata for partial-wallet Razorpay flows.
 */
export function resolveWalletAmountPaidFromPayments(payments: PaymentLike[]): number {
  const captured = payments.filter((p) => p.status === 'captured');
  for (const payment of captured) {
    const meta = payment.metadata as { walletAmount?: number } | null;
    const walletAmount = parseFloat(Number(meta?.walletAmount ?? 0).toFixed(2));
    if (walletAmount > 0) return walletAmount;
  }
  return 0;
}

export function resolveWalletAmountPaid(
  orderId: string,
  payments: PaymentLike[],
  walletPaidByOrderId?: Map<string, number>,
): number {
  const fromMap = walletPaidByOrderId?.get(orderId);
  if (fromMap !== undefined && fromMap > 0) return fromMap;
  if (fromMap === 0 && walletPaidByOrderId?.has(orderId)) {
    return 0;
  }
  return resolveWalletAmountPaidFromPayments(payments);
}
