import redis from '@config/redis';
import logger from '@utils/logger';
import { AppError } from '@utils/appError';
import { addStoreOtpJob } from '@queues/emailQueue';

// TODO: replace with a real SMS/email OTP provider (Twilio, Termii, etc.)
const OTP_VALUE = '1234';
const OTP_TTL = 600; // 10 minutes

// ─── Redis key helpers ────────────────────────────────────────────────────────

export function phoneOtpKey(phone: string): string {
  return `otp:phone:${phone}`;
}
export function emailOtpKey(email: string): string {
  return `otp:email:${email}`;
}
export function phoneVerifiedKey(phone: string): string {
  return `verified:phone:${phone}`;
}
export function emailVerifiedKey(email: string): string {
  return `verified:email:${email}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class OtpService {
  // ─── Phone ────────────────────────────────────────────────────────────────

  async sendPhoneOtp(phone: string): Promise<void> {
    await redis.set(phoneOtpKey(phone), OTP_VALUE, 'EX', OTP_TTL);
    // TODO: send real SMS via provider
    logger.info({ phone }, 'Phone OTP sent (stub)');
  }

  async verifyPhoneOtp(phone: string, otp: string): Promise<void> {
    const stored = await redis.get(phoneOtpKey(phone));
    if (!stored) throw AppError.badRequest('OTP expired or not sent', 'OTP_EXPIRED');
    if (stored !== otp) throw AppError.badRequest('Invalid OTP', 'INVALID_OTP');

    await redis.del(phoneOtpKey(phone));
    await redis.set(phoneVerifiedKey(phone), '1', 'EX', OTP_TTL);
  }

  // ─── Email ────────────────────────────────────────────────────────────────

  async sendEmailOtp(email: string): Promise<void> {
    await redis.set(emailOtpKey(email), OTP_VALUE, 'EX', OTP_TTL);
    try {
      await addStoreOtpJob(email, OTP_VALUE);
    } catch (err) {
      logger.error({ err, email }, 'Failed to enqueue email OTP job');
    }
    logger.info({ email }, 'Email OTP sent (stub)');
  }

  async verifyEmailOtp(email: string, otp: string): Promise<void> {
    const stored = await redis.get(emailOtpKey(email));
    if (!stored) throw AppError.badRequest('OTP expired or not sent', 'OTP_EXPIRED');
    if (stored !== otp) throw AppError.badRequest('Invalid OTP', 'INVALID_OTP');

    await redis.del(emailOtpKey(email));
    await redis.set(emailVerifiedKey(email), '1', 'EX', OTP_TTL);
  }

  // ─── Helpers for consumers (e.g. store creation) ─────────────────────────

  async assertPhoneVerified(phone: string): Promise<void> {
    const flag = await redis.get(phoneVerifiedKey(phone));
    if (!flag) throw AppError.badRequest('Phone number has not been verified', 'PHONE_NOT_VERIFIED');
  }

  async assertEmailVerified(email: string): Promise<void> {
    const flag = await redis.get(emailVerifiedKey(email));
    if (!flag) throw AppError.badRequest('Email address has not been verified', 'EMAIL_NOT_VERIFIED');
  }

  async clearVerifiedFlags(phone?: string | null, email?: string | null): Promise<void> {
    const keys: string[] = [];
    if (phone) keys.push(phoneVerifiedKey(phone));
    if (email) keys.push(emailVerifiedKey(email));
    if (keys.length) {
      redis.del(...keys).catch((err) =>
        logger.error({ err }, 'Failed to clear OTP verified flags'),
      );
    }
  }
}

export default new OtpService();
