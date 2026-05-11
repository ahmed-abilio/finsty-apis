import sequelize from '@config/database';

import Wallet from './wallet.model';
import WalletTransaction from './wallet-transaction.model';
import { AppError } from '@utils/appError';
import { paymentProvider } from '@utils/paymentProvider';
import type { TransactionSource } from './wallet-transaction.model';

export interface TopupInitiateInput {
  amount: number;
  reference: string;
}

export interface TopupVerifyInput {
  reference: string;
  providerReference: string;
}

export interface PayInput {
  amount: number;
  reference: string;
  source?: TransactionSource;
  metadata?: object;
}

export interface RefundInput {
  userId: string;
  amount: number;
  reference: string;
  metadata?: object;
}

export interface ListTransactionsQuery {
  page?: number;
  limit?: number;
  type?: 'credit' | 'debit';
  source?: TransactionSource;
  status?: 'pending' | 'successful' | 'failed';
}

class WalletService {
  // ─── Ensure wallet exists (create on first use) ──────────────────────────────

  async ensureWallet(userId: string): Promise<Wallet> {
    const [wallet] = await Wallet.findOrCreate({
      where: { userId },
      defaults: { userId, balance: 0, currency: 'NGN', isActive: true },
    });
    return wallet;
  }

  // ─── GET my wallet ────────────────────────────────────────────────────────────

  async getWallet(userId: string): Promise<Wallet> {
    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');
    return wallet;
  }

  // ─── LIST transactions ────────────────────────────────────────────────────────

  async listTransactions(userId: string, query: ListTransactionsQuery) {
    const { page = 1, limit = 20, type, source, status } = query;

    const wallet = await this.getWallet(userId);
    const where: Record<string, unknown> = { walletId: wallet.id };
    if (type) where['type'] = type;
    if (source) where['source'] = source;
    if (status) where['status'] = status;

    const offset = (page - 1) * limit;
    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      transactions: rows.map((t) => t.toPublicJSON()),
      total: count,
      page,
      limit,
    };
  }

  // ─── GET single transaction ───────────────────────────────────────────────────

  async getTransaction(userId: string, reference: string) {
    const wallet = await this.getWallet(userId);
    const tx = await WalletTransaction.findOne({
      where: { reference, walletId: wallet.id },
    });
    if (!tx) throw AppError.notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');
    return tx.toPublicJSON();
  }

  // ─── TOPUP: initiate ──────────────────────────────────────────────────────────

  async initiateTopup(userId: string, input: TopupInitiateInput) {
    const wallet = await this.ensureWallet(userId);

    if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

    const result = await paymentProvider.initiate({
      amount: input.amount,
      currency: wallet.currency,
      reference: input.reference,
      metadata: { userId },
    });

    // Record a pending transaction so we can verify it later
    await WalletTransaction.create({
      walletId: wallet.id,
      reference: input.reference,
      type: 'credit',
      amount: input.amount,
      fee: 0,
      balanceBefore: Number(wallet.balance),
      balanceAfter: Number(wallet.balance), // will be updated on verify
      status: 'pending',
      source: 'topup',
      provider: process.env.PAYMENT_PROVIDER ?? 'manual',
      providerReference: result.provider_reference,
      metadata: null,
    });

    return {
      reference: input.reference,
      amount: input.amount,
      currency: wallet.currency,
      provider: process.env.PAYMENT_PROVIDER ?? 'manual',
      checkout_url: result.checkout_url,
      provider_reference: result.provider_reference,
    };
  }

  // ─── TOPUP: verify & credit ───────────────────────────────────────────────────

  async verifyTopup(userId: string, input: TopupVerifyInput) {
    const wallet = await this.getWallet(userId);
    if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

    // Idempotency: find the pending tx by reference
    const tx = await WalletTransaction.findOne({
      where: { reference: input.reference, walletId: wallet.id },
    });

    if (!tx) throw AppError.notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');

    // Already processed — return existing record
    if (tx.status === 'successful') return tx.toPublicJSON();
    if (tx.status === 'failed')
      throw AppError.badRequest('Top-up previously failed', 'TOPUP_VERIFICATION_FAILED');

    // Verify with provider
    let verifyResult: { status: 'successful' | 'failed'; amount: number };
    try {
      verifyResult = await paymentProvider.verify(input.providerReference);
    } catch {
      await tx.update({ status: 'failed' });
      throw AppError.badRequest('Payment verification failed', 'TOPUP_VERIFICATION_FAILED');
    }

    if (verifyResult.status !== 'successful') {
      await tx.update({ status: 'failed' });
      throw AppError.badRequest('Payment was not successful', 'TOPUP_VERIFICATION_FAILED');
    }

    // Atomic balance update
    const t = await sequelize.transaction();
    try {
      const lockedWallet = await Wallet.findOne({
        where: { id: wallet.id },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!lockedWallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');

      const balanceBefore = Number(lockedWallet.balance);
      const balanceAfter = parseFloat((balanceBefore + Number(tx.amount)).toFixed(2));

      await lockedWallet.update({ balance: balanceAfter }, { transaction: t });
      await tx.update(
        {
          status: 'successful',
          balanceBefore,
          balanceAfter,
          providerReference: input.providerReference,
        },
        { transaction: t },
      );

      await t.commit();
      return tx.toPublicJSON();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  // ─── PAY (debit wallet) ───────────────────────────────────────────────────────

  async pay(userId: string, input: PayInput) {
    // Idempotency check
    const existingTx = await WalletTransaction.findOne({ where: { reference: input.reference } });
    if (existingTx) {
      if (existingTx.status === 'successful') return existingTx.toPublicJSON();
      throw AppError.conflict('Duplicate reference', 'DUPLICATE_REFERENCE');
    }

    const t = await sequelize.transaction();
    try {
      const wallet = await Wallet.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');
      if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

      const balanceBefore = Number(wallet.balance);
      if (balanceBefore < input.amount) {
        throw AppError.badRequest('Insufficient wallet balance', 'INSUFFICIENT_FUNDS');
      }

      const balanceAfter = parseFloat((balanceBefore - input.amount).toFixed(2));

      await wallet.update({ balance: balanceAfter }, { transaction: t });

      const tx = await WalletTransaction.create(
        {
          walletId: wallet.id,
          reference: input.reference,
          type: 'debit',
          amount: input.amount,
          fee: 0,
          balanceBefore,
          balanceAfter,
          status: 'successful',
          source: input.source ?? 'order_payment',
          provider: null,
          providerReference: null,
          metadata: input.metadata ?? null,
        },
        { transaction: t },
      );

      await t.commit();
      return tx.toPublicJSON();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  // ─── REFUND (credit wallet — admin/internal) ──────────────────────────────────

  async refund(input: RefundInput) {
    // Idempotency check
    const existingTx = await WalletTransaction.findOne({ where: { reference: input.reference } });
    if (existingTx) {
      if (existingTx.status === 'successful') return existingTx.toPublicJSON();
      throw AppError.conflict('Duplicate reference', 'DUPLICATE_REFERENCE');
    }

    const t = await sequelize.transaction();
    try {
      const wallet = await Wallet.findOne({
        where: { userId: input.userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND');
      if (!wallet.isActive) throw AppError.badRequest('Wallet is inactive', 'WALLET_INACTIVE');

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = parseFloat((balanceBefore + input.amount).toFixed(2));

      await wallet.update({ balance: balanceAfter }, { transaction: t });

      const tx = await WalletTransaction.create(
        {
          walletId: wallet.id,
          reference: input.reference,
          type: 'credit',
          amount: input.amount,
          fee: 0,
          balanceBefore,
          balanceAfter,
          status: 'successful',
          source: 'refund',
          provider: null,
          providerReference: null,
          metadata: input.metadata ?? null,
        },
        { transaction: t },
      );

      await t.commit();
      return tx.toPublicJSON();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
}

export default new WalletService();
