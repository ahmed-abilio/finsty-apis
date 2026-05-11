import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
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
  amount: number;
  currency?: string;
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

  async initiatePayment(userId: string, input: InitiatePaymentInput) {
    const { orderId, amount, currency = 'INR' } = input;

    // Validate order ownership and status
    if (orderId) {
      const order = await Order.findOne({ where: { id: orderId, userId } });
      if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
      if (order.status !== 'pending') {
        throw AppError.badRequest(
          'Only pending orders can be paid',
          'ORDER_NOT_PAYABLE',
        );
      }
    }

    // Ensure wallet exists
    const [wallet] = await Wallet.findOrCreate({
      where: { userId },
      defaults: { userId, balance: 0, currency, isActive: true },
    });

    if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

    const reference = uuidv4();

    // Call provider — this is external and cannot be rolled back if DB fails
    const result = await paymentProvider.initiate({
      amount,
      currency,
      reference,
      metadata: { userId, orderId: orderId ?? null },
    });
    console.log(result);
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
console.log(result);
      return {
        paymentId: payment.id,
        checkoutUrl: result.checkout_url,
        providerOrderId: result.provider_reference,
        amount: Number(payment.amount),
        currency: payment.currency,
      };
    } catch (err) {
      // DB insert failed after provider order was already created — log for ops reconciliation
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

    const t = await sequelize.transaction();
    try {
      // 1. Update payment
      await payment.update(
        { status: 'captured', providerPaymentId, providerSignature, paymentType: verified.paymentType ?? null },
        { transaction: t },
      );

      let currentBalance = 0;

      const lockedWallet = await Wallet.findOne({
        where: { id: payment.walletId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!lockedWallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');
      
      currentBalance = Number(lockedWallet.balance);

      if (payment.orderId) {
        // Direct Order Checkout Flow
        const order = await Order.findOne({
          where: { id: payment.orderId },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (order) {
          await order.update({ status: 'confirmed' }, { transaction: t });

          // Clear the cart items that were locked into this order
          const metadata = order.metadata as { cartItemIds?: string[] } | null;
          if (metadata?.cartItemIds && Array.isArray(metadata.cartItemIds)) {
            await CartItem.destroy({
              where: { id: metadata.cartItemIds },
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
      return { success: true, walletBalance: currentBalance };
    } catch (err) {
      await t.rollback();
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

  // ─── Get config ────────────────────────────────────────────────────────────

  async getPaymentConfig() {
    return {
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    };
  }
}

export default new PaymentService();
