import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { Transaction } from 'sequelize';
import sequelize from '@config/database';
import { AppError } from '@utils/appError';
import { paymentProvider } from '@utils/paymentProvider';
import logger from '@utils/logger';

import Payment, { PaymentStatus } from './payment.model';
import Order from '@modules/order/order.model';
import Wallet from '@modules/wallet/wallet.model';
import WalletTransaction from '@modules/wallet/wallet-transaction.model';
import CartItem from '@modules/cart/cart-item.model';
import emailQueue from '@queues/emailQueue';
import { assertOrderDeliveryShadowfaxValidForPayment } from '@modules/order/orderDeliveryValidation';
import { scheduleShadowfaxPlacementIfDelivery } from '@modules/shadowfax/shadowfaxPlacement.service';
import { buildAmountMismatchContext } from '@utils/paymentAmountValidation';
import { NotificationType } from '@modules/notification/notification.types';
import { formatOrderNumber, notifyUser } from '@modules/notification/notification.service';
import {
  notifyBuyerOrderStatus,
  notifyOrderPlacedAfterPayment,
  notifyPaymentCancelled,
} from '@modules/notification/notification.order';

// ─── State machine: valid transitions ─────────────────────────────────────────

const ALLOWED_TRANSITIONS: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  pending: ['captured', 'failed'],
  captured: ['refund_requested'],
  refund_requested: ['refunded'],
};

function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw AppError.badRequest(
      `Cannot transition payment from "${from}" to "${to}"`,
      'INVALID_PAYMENT_STATUS',
    );
  }
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifyRazorpaySignature(
  providerOrderId: string,
  providerPaymentId: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw AppError.internal('Razorpay secret not configured');

  const body = `${providerOrderId}|${providerPaymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface InitiatePaymentInput {
  orderId?: string;
  amount?: number;
  currency?: string;
  useWallet?: boolean;
}

export interface InitiatePaymentResult {
  // Razorpay path
  paymentId?: string;
  checkoutUrl?: string;
  providerOrderId?: string;
  amount?: number;
  currency?: string;
  walletAmountToBeDeducted?: number;
  // Full-wallet path
  fullyPaidByWallet?: boolean;
  walletBalance?: number;
  walletAmountUsed?: number;
  orderId?: string;
}

export interface CapturePaymentInput {
  paymentId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface RequestRefundInput {
  paymentId: string;
  reason?: string;
}

export interface ProcessRefundInput {
  paymentId: string;
  note?: string;
}

class PaymentService {
  // ─── Initiate ──────────────────────────────────────────────────────────────

  async initiatePayment(userId: string, input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const { orderId, currency = 'INR', useWallet } = input;
    let { amount } = input;

    // Ensure wallet exists (needed for all paths)
    const [wallet] = await Wallet.findOrCreate({
      where: { userId },
      defaults: { userId, balance: 0, currency, isActive: true },
    });

    if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

    // ── useWallet path ──────────────────────────────────────────────────────
    if (useWallet) {
      if (!orderId) {
        throw AppError.badRequest('orderId is required when useWallet is true', 'ORDER_REQUIRED');
      }

      const order = await Order.findOne({ where: { id: orderId, userId } });
      if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
      if (order.status !== 'pending') {
        throw AppError.badRequest('Only pending orders can be paid', 'ORDER_NOT_PAYABLE');
      }

      await assertOrderDeliveryShadowfaxValidForPayment(order, userId);

      const totalAmount = parseFloat(Number(order.totalAmount).toFixed(2));
      const walletBalance = parseFloat(Number(wallet.balance).toFixed(2));
      const walletAmount = parseFloat(Math.min(walletBalance, totalAmount).toFixed(2));
      const razorpayAmount = parseFloat((totalAmount - walletAmount).toFixed(2));

      // SECURITY: in the wallet path, `amount` returned to the client is the
      // Razorpay portion (order total minus wallet balance applied). If the
      // client sends `amount`, it must match that server-computed value within
      // 0.01 INR. Mismatched values (including a full-wallet request that
      // still ships a non-zero amount) are rejected before Razorpay is hit.
      if (amount !== undefined && Math.abs(Number(amount) - razorpayAmount) > 0.01) {
        const mismatch = buildAmountMismatchContext({
          order,
          clientAmount: Number(amount),
          suggestedAmount: razorpayAmount,
          useWallet: true,
          walletAmount,
        });
        logger.warn(
          { userId, orderId, expectedRazorpayAmount: razorpayAmount, ...mismatch },
          'Wallet payment amount mismatch — client value differs from server-computed Razorpay portion',
        );
        throw AppError.badRequest(
          'Payment amount does not match expected charge (order total minus wallet balance)',
          'AMOUNT_MISMATCH',
          { ...mismatch },
        );
      }

      // Case A — wallet covers everything
      if (razorpayAmount === 0) {
        let deliveryOrderIdForShadowfax: string | null = null;
        const t = await sequelize.transaction();
        try {
          const lockedWallet = await Wallet.findOne({
            where: { id: wallet.id },
            lock: t.LOCK.UPDATE,
            transaction: t,
          });
          if (!lockedWallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');

          const balanceBefore = parseFloat(Number(lockedWallet.balance).toFixed(2));
          if (balanceBefore < totalAmount) {
            throw AppError.badRequest('Insufficient wallet balance', 'INSUFFICIENT_FUNDS');
          }
          const balanceAfter = parseFloat((balanceBefore - totalAmount).toFixed(2));

          await lockedWallet.update({ balance: balanceAfter }, { transaction: t });

          await WalletTransaction.create(
            {
              walletId: lockedWallet.id,
              reference: `wallet_pay_order_${orderId}`,
              type: 'debit',
              amount: totalAmount,
              fee: 0,
              balanceBefore,
              balanceAfter,
              status: 'successful',
              source: 'order_payment',
              provider: null,
              providerReference: null,
              metadata: { orderId, paymentMode: 'full_wallet' },
            },
            { transaction: t },
          );

          const lockedOrder = await Order.findOne({
            where: { id: orderId },
            lock: t.LOCK.UPDATE,
            transaction: t,
          });

          if (lockedOrder) {
            await lockedOrder.update({ status: 'confirmed' }, { transaction: t });

            if (lockedOrder.deliveryType === 'delivery') {
              deliveryOrderIdForShadowfax = lockedOrder.id;
            }

            const orderMeta = lockedOrder.metadata as { cartItemIds?: string[] } | null;
            if (orderMeta?.cartItemIds && Array.isArray(orderMeta.cartItemIds)) {
              await CartItem.destroy({
                where: { id: orderMeta.cartItemIds },
                transaction: t,
              });
            }
          }

          await t.commit();

          if (deliveryOrderIdForShadowfax) {
            scheduleShadowfaxPlacementIfDelivery({
              id: deliveryOrderIdForShadowfax,
              deliveryType: 'delivery',
            });
          }

          void notifyOrderPlacedAfterPayment(userId, orderId);
          notifyBuyerOrderStatus(userId, orderId, 'confirmed');

          return {
            fullyPaidByWallet: true,
            walletBalance: balanceAfter,
            walletAmountUsed: totalAmount,
            orderId,
          };
        } catch (err) {
          await t.rollback();
          if (err instanceof AppError) throw err;
          logger.error({ err, orderId, userId }, 'Full wallet payment failed');
          throw AppError.internal('Full wallet payment failed', 'WALLET_PAYMENT_FAILED');
        }
      }

      // Case B — partial: Razorpay covers razorpayAmount, wallet covers walletAmount on capture
      const reference = uuidv4();
      const result = await paymentProvider.initiate({
        amount: razorpayAmount,
        currency,
        reference,
        metadata: { userId, orderId },
      });

      try {
        const payment = await Payment.create({
          orderId,
          walletId: wallet.id,
          userId,
          amount: razorpayAmount,
          currency,
          status: 'pending',
          provider: process.env.PAYMENT_PROVIDER ?? 'manual',
          providerOrderId: result.provider_reference,
          metadata: { walletAmount, paymentMode: 'partial' },
        });

        return {
          paymentId: payment.id,
          checkoutUrl: result.checkout_url,
          providerOrderId: result.provider_reference,
          amount: razorpayAmount,
          currency,
          walletAmountToBeDeducted: walletAmount,
        };
      } catch (err) {
        logger.error(
          { err, providerOrderId: result.provider_reference, userId, amount: razorpayAmount },
          'Payment DB insert failed after provider order creation — dangling provider order needs manual reconciliation',
        );
        throw AppError.internal('Failed to record payment', 'PAYMENT_RECORD_FAILED');
      }
    }

    // ── Normal Razorpay path (no wallet) ────────────────────────────────────
    // SECURITY: for order payments, the amount is ALWAYS computed server-side
    // from `Order.totalAmount` (which already accounts for cart price, tax,
    // delivery, coupon discount, etc.). The client-supplied `amount` is never
    // trusted — at most we use it to detect a stale checkout screen and
    // fail-fast with AMOUNT_MISMATCH. For wallet top-ups (no orderId) the
    // client `amount` is required because there is no server-side reference.
    if (orderId) {
      const order = await Order.findOne({ where: { id: orderId, userId } });
      if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
      if (order.status !== 'pending') {
        throw AppError.badRequest('Only pending orders can be paid', 'ORDER_NOT_PAYABLE');
      }

      await assertOrderDeliveryShadowfaxValidForPayment(order, userId);

      const expectedAmount = parseFloat(Number(order.totalAmount).toFixed(2));

      if (amount !== undefined && Math.abs(Number(amount) - expectedAmount) > 0.01) {
        const mismatch = buildAmountMismatchContext({
          order,
          clientAmount: Number(amount),
          suggestedAmount: expectedAmount,
          useWallet: false,
        });
        logger.warn(
          { userId, orderId, expectedAmount, ...mismatch },
          'Order payment amount mismatch — client value differs from server-calculated order total',
        );
        throw AppError.badRequest(
          'Payment amount does not match order total',
          'AMOUNT_MISMATCH',
          { ...mismatch },
        );
      }

      amount = expectedAmount;
    } else {
      if (!amount || amount <= 0) {
        throw AppError.badRequest('amount is required', 'AMOUNT_REQUIRED');
      }
    }

    const reference = uuidv4();

    const result = await paymentProvider.initiate({
      amount,
      currency,
      reference,
      metadata: { userId, orderId: orderId ?? null },
    });

    try {
      const payment = await Payment.create({
        orderId: orderId ?? null,
        walletId: wallet.id,
        userId,
        amount,
        currency,
        status: 'pending',
        provider: process.env.PAYMENT_PROVIDER ?? 'manual',
        providerOrderId: result.provider_reference,
      });

      return {
        paymentId: payment.id,
        checkoutUrl: result.checkout_url,
        providerOrderId: result.provider_reference,
        amount: Number(payment.amount),
        currency: payment.currency,
      };
    } catch (err) {
      logger.error(
        { err, providerOrderId: result.provider_reference, userId, amount },
        'Payment DB insert failed after provider order creation — dangling provider order needs manual reconciliation',
      );
      throw AppError.internal('Failed to record payment', 'PAYMENT_RECORD_FAILED');
    }
  }

  // ─── Capture ───────────────────────────────────────────────────────────────

  async capturePayment(userId: string, input: CapturePaymentInput) {
    const { paymentId, providerPaymentId, providerSignature } = input;

    const payment = await Payment.findOne({ where: { id: paymentId } });
    if (!payment) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    if (payment.userId !== userId) throw AppError.forbidden('Access denied', 'FORBIDDEN');

    // Idempotency: already captured with this exact payment id
    if (payment.providerPaymentId === providerPaymentId && payment.status === 'captured') {
      const wallet = await Wallet.findOne({ where: { id: payment.walletId } });
      return { success: true, walletBalance: Number(wallet?.balance ?? 0) };
    }

    assertTransition(payment.status, 'captured');

    // Signature verification BEFORE any DB write
    const signatureValid = verifyRazorpaySignature(
      payment.providerOrderId,
      providerPaymentId,
      providerSignature,
    );
    if (!signatureValid) {
      throw AppError.badRequest('Payment signature is invalid', 'INVALID_SIGNATURE');
    }

    // Verify with provider
    const verified = await paymentProvider.verify(providerPaymentId);
    if (verified.status !== 'successful') {
      await payment.update({ status: 'failed' });
      notifyUser(userId, NotificationType.PAYMENT_FAILED, {
        orderId: payment.orderId ?? undefined,
      });
      throw AppError.badRequest('Payment was not successful with provider', 'PAYMENT_FAILED');
    }

    // Validate amount (within 1 paisa = 0.01 INR tolerance)
    const amountMismatch = Math.abs(verified.amount - Number(payment.amount)) > 0.01;
    if (amountMismatch) {
      logger.error(
        { paymentId, expected: payment.amount, received: verified.amount },
        'Payment amount mismatch',
      );
      throw AppError.badRequest('Payment amount mismatch', 'AMOUNT_MISMATCH');
    }

    // SECURITY: for order-linked payments, also confirm that the *total* paid
    // (Razorpay portion + wallet portion held in metadata) matches the
    // server-calculated order total. This catches any drift between initiate
    // and capture (e.g. tampered metadata, mutated order, recalculated
    // discount) before we mark the order as confirmed.
    if (payment.orderId) {
      const orderForValidation = await Order.findOne({ where: { id: payment.orderId } });
      if (!orderForValidation) {
        throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
      }

      const paymentMeta = payment.metadata as { walletAmount?: number; paymentMode?: string } | null;
      const walletPortion = parseFloat(Number(paymentMeta?.walletAmount ?? 0).toFixed(2));
      const razorpayPortion = parseFloat(Number(payment.amount).toFixed(2));
      const totalPaid = parseFloat((walletPortion + razorpayPortion).toFixed(2));
      const expectedTotal = parseFloat(Number(orderForValidation.totalAmount).toFixed(2));

      if (Math.abs(totalPaid - expectedTotal) > 0.01) {
        logger.error(
          {
            paymentId,
            orderId: payment.orderId,
            expectedTotal,
            totalPaid,
            razorpayPortion,
            walletPortion,
          },
          'Captured payment total does not match order total',
        );
        throw AppError.badRequest(
          'Paid amount does not match order total',
          'AMOUNT_MISMATCH',
        );
      }
    }

    const t = await sequelize.transaction();
    let confirmedDeliveryOrder: Order | null = null;
    try {
      // 1. Update payment
      await payment.update(
        { status: 'captured', providerPaymentId, providerSignature, paymentType: verified.paymentType ?? null },
        { transaction: t },
      );

      let currentBalance = 0;
      let walletAmountUsed = 0;

      const lockedWallet = await Wallet.findOne({
        where: { id: payment.walletId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!lockedWallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');

      currentBalance = parseFloat(Number(lockedWallet.balance).toFixed(2));

      if (payment.orderId) {
        // Check if this was a partial payment (wallet + Razorpay)
        const paymentMeta = payment.metadata as { walletAmount?: number; paymentMode?: string } | null;
        const walletAmount = parseFloat(Number(paymentMeta?.walletAmount ?? 0).toFixed(2));

        if (walletAmount > 0) {
          // Deduct the wallet portion atomically
          if (currentBalance < walletAmount) {
            throw AppError.badRequest(
              'Insufficient wallet balance to complete partial payment',
              'INSUFFICIENT_FUNDS',
            );
          }

          const balanceBefore = currentBalance;
          const balanceAfter = parseFloat((balanceBefore - walletAmount).toFixed(2));

          await lockedWallet.update({ balance: balanceAfter }, { transaction: t });

          await WalletTransaction.create(
            {
              walletId: lockedWallet.id,
              reference: `wallet_pay_order_${payment.orderId}`,
              type: 'debit',
              amount: walletAmount,
              fee: 0,
              balanceBefore,
              balanceAfter,
              status: 'successful',
              source: 'order_payment',
              provider: null,
              providerReference: null,
              metadata: {
                paymentId,
                razorpayAmount: Number(payment.amount),
                paymentMode: 'partial_wallet',
              },
            },
            { transaction: t },
          );

          currentBalance = balanceAfter;
          walletAmountUsed = walletAmount;
        }

        // Confirm order and clear cart
        const order = await Order.findOne({
          where: { id: payment.orderId },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (order) {
          await order.update({ status: 'confirmed' }, { transaction: t });

          if (order.deliveryType === 'delivery') {
            confirmedDeliveryOrder = order;
          }

          const orderMeta = order.metadata as { cartItemIds?: string[] } | null;
          if (orderMeta?.cartItemIds && Array.isArray(orderMeta.cartItemIds)) {
            await CartItem.destroy({
              where: { id: orderMeta.cartItemIds },
              transaction: t,
            });
          }
        }
      } else {
        // Wallet Top-up Flow
        const balanceBefore = currentBalance;
        const balanceAfter = parseFloat((balanceBefore + Number(payment.amount)).toFixed(2));

        await lockedWallet.update({ balance: balanceAfter }, { transaction: t });

        await WalletTransaction.create(
          {
            walletId: lockedWallet.id,
            reference: `topup_${paymentId}`,
            type: 'credit',
            amount: Number(payment.amount),
            fee: 0,
            balanceBefore,
            balanceAfter,
            status: 'successful',
            source: 'topup',
            provider: payment.provider,
            providerReference: providerPaymentId,
            metadata: { paymentId },
          },
          { transaction: t },
        );
        currentBalance = balanceAfter;
      }

      await t.commit();

      if (confirmedDeliveryOrder) {
        scheduleShadowfaxPlacementIfDelivery(confirmedDeliveryOrder);
      }

      if (payment.orderId) {
        const orderNumber = formatOrderNumber(payment.orderId);
        notifyUser(userId, NotificationType.PAYMENT_SUCCESS, {
          orderId: payment.orderId,
          orderNumber,
          amount: Number(payment.amount) + walletAmountUsed,
        });
        void notifyOrderPlacedAfterPayment(userId, payment.orderId);
        notifyBuyerOrderStatus(userId, payment.orderId, 'confirmed');
      } else {
        notifyUser(userId, NotificationType.WALLET_CREDITED, {
          amount: Number(payment.amount),
        });
      }

      return {
        success: true,
        walletBalance: currentBalance,
        walletAmountUsed,
        razorpayAmountPaid: Number(payment.amount),
      };
    } catch (err) {
      await t.rollback();
      if (err instanceof AppError) throw err;
      throw AppError.internal('Payment capture failed', 'PAYMENT_CAPTURE_FAILED');
    }
  }

  // ─── Request refund ────────────────────────────────────────────────────────

  async requestRefund(userId: string, input: RequestRefundInput) {
    const { paymentId, reason } = input;

    const payment = await Payment.findOne({ where: { id: paymentId } });
    if (!payment) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    if (payment.userId !== userId) throw AppError.forbidden('Access denied', 'FORBIDDEN');

    assertTransition(payment.status, 'refund_requested');

    // Only cancelled orders are eligible for refund
    if (payment.orderId) {
      const order = await Order.findOne({ where: { id: payment.orderId } });
      if (!order || order.status !== 'cancelled') {
        throw AppError.badRequest(
          'Refunds are only available for cancelled orders',
          'ORDER_NOT_CANCELLED',
        );
      }
    }

    const t = await sequelize.transaction();
    try {
      await payment.update(
        {
          status: 'refund_requested',
          refundRequestedAt: new Date(),
          refundNote: reason ?? null,
        },
        { transaction: t },
      );

      // Mark refund as pending in wallet transactions (funds held, not yet credited)
      await WalletTransaction.create(
        {
          walletId: payment.walletId,
          reference: `refund_req_${paymentId}`,
          type: 'debit',
          amount: Number(payment.amount),
          fee: 0,
          balanceBefore: 0, // will be updated when admin processes
          balanceAfter: 0,
          status: 'pending',
          source: 'refund',
          provider: null,
          providerReference: null,
          metadata: { paymentId, reason: reason ?? null },
        },
        { transaction: t },
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // Notify admin via queue (fire-and-forget — does not affect response)
    try {
      await emailQueue.add('refund_requested', {
        type: 'welcome', // reusing EmailJobData union — worker should handle 'refund_requested' type
        userId,
        email: '',
        // cast to carry payload; worker must be updated to handle this job name
      } as any, {
        jobId: `refund_req_${paymentId}`,
      });
    } catch (qErr) {
      logger.error({ qErr, paymentId }, 'Failed to enqueue refund_requested admin notification');
    }

    return {
      success: true,
      message: 'Refund request submitted. Admin will credit your wallet.',
    };
  }

  // ─── Process refund (admin) ────────────────────────────────────────────────

  async processRefund(adminUserId: string, input: ProcessRefundInput) {
    const { paymentId, note } = input;

    // Load and validate outside transaction first (fast fail)
    const preCheck = await Payment.findOne({ where: { id: paymentId } });
    if (!preCheck) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    if (preCheck.status !== 'refund_requested') {
      throw AppError.badRequest('Payment is not in refund_requested state', 'INVALID_PAYMENT_STATUS');
    }

    const t = await sequelize.transaction();
    try {
      // Re-check with row lock inside transaction to prevent double-processing
      const payment = await Payment.findOne({
        where: { id: paymentId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!payment) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
      if (payment.status !== 'refund_requested') {
        throw AppError.badRequest('Payment is not in refund_requested state', 'INVALID_PAYMENT_STATUS');
      }

      // 1. Update payment to refunded
      await payment.update(
        {
          status: 'refunded',
          refundProcessedAt: new Date(),
          refundNote: note
            ? `${payment.refundNote ? payment.refundNote + ' | ' : ''}Admin: ${note}`
            : payment.refundNote,
        },
        { transaction: t },
      );

      // 2. Find the pending WalletTransaction for this refund request
      const pendingTx = await WalletTransaction.findOne({
        where: {
          reference: `refund_req_${paymentId}`,
          status: 'pending',
          source: 'refund',
        },
        transaction: t,
      });
      if (!pendingTx) {
        throw AppError.internal('Refund transaction record not found', 'REFUND_TX_MISSING');
      }

      // 3. Credit wallet with row lock
      const wallet = await Wallet.findOne({
        where: { id: payment.walletId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');
      if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

      const balanceBefore = Number(wallet.balance);
      const refundAmount = Number(payment.amount);
      const balanceAfter = parseFloat((balanceBefore + refundAmount).toFixed(2));

      await wallet.update({ balance: balanceAfter }, { transaction: t });

      // 4. Mark the pending tx as successful and set correct balances
      await pendingTx.update(
        {
          status: 'successful',
          type: 'credit', // flip: was debit (held), now credit (processed)
          balanceBefore,
          balanceAfter,
        },
        { transaction: t },
      );

      await t.commit();

      logger.info({ paymentId, adminUserId, refundAmount }, 'Refund processed successfully');
      return { success: true };
    } catch (err) {
      await t.rollback();
      if (err instanceof AppError) throw err;
      logger.error({ err, paymentId }, 'Refund processing failed');
      throw AppError.internal('Refund processing failed', 'REFUND_PROCESS_FAILED');
    }
  }

  // ─── Get payment ───────────────────────────────────────────────────────────

  async getPayment(userId: string, paymentId: string, isAdmin: boolean) {
    const where: Record<string, unknown> = { id: paymentId };
    if (!isAdmin) where['userId'] = userId;

    const payment = await Payment.findOne({ where });
    if (!payment) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    return payment.toPublicJSON();
  }

  // ─── List refund requests (admin) ─────────────────────────────────────────

  async listRefundRequests(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { count, rows } = await Payment.findAndCountAll({
      where: { status: 'refund_requested' },
      order: [['refundRequestedAt', 'ASC']],
      limit,
      offset,
    });

    return {
      payments: rows.map((p) => p.toPublicJSON()),
      total: count,
      page,
      limit,
    };
  }

  // ─── Cancel incomplete (checkout dismissed) ────────────────────────────────

  /**
   * Marks pending Razorpay attempts as failed and notifies the buyer.
   * Call when the user closes the payment UI without capturing.
   */
  async cancelIncompletePayment(userId: string, orderId: string): Promise<{ paymentsFailed: number }> {
    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    if (order.status !== 'pending') {
      throw AppError.badRequest(
        'Only pending orders with incomplete payment can be cancelled',
        'ORDER_NOT_PAYABLE',
      );
    }

    const paymentsFailed = await failPendingPaymentsForOrder(orderId);
    notifyPaymentCancelled(userId, orderId);

    return { paymentsFailed };
  }

  // ─── Get config ────────────────────────────────────────────────────────────

  async getPaymentConfig() {
    return {
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    };
  }
}

/** Mark open payment attempts as failed so the buyer can initiate again. */
export async function failPendingPaymentsForOrder(
  orderId: string,
  transaction?: Transaction,
): Promise<number> {
  const pending = await Payment.findAll({ where: { orderId, status: 'pending' }, transaction });
  for (const payment of pending) {
    assertTransition(payment.status, 'failed');
    await payment.update({ status: 'failed' }, { transaction });
  }
  return pending.length;
}

export default new PaymentService();
