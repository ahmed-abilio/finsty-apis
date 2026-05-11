import { Queue } from 'bullmq';
import { getQueueOptions } from '@config/bullmq';

// ─── Job payload types ────────────────────────────────────────────────────────

export interface WelcomeEmailJob {
  type: 'welcome';
  userId: string;
  email: string;
  name?: string;
}

export interface PasswordResetEmailJob {
  type: 'password_reset';
  userId: string;
  email: string;
  resetLink: string;
}

export interface StoreOtpEmailJob {
  type: 'store_otp';
  email: string;
  otp: string;
  storeName?: string;
}

export type EmailJobData = WelcomeEmailJob | PasswordResetEmailJob | StoreOtpEmailJob;

// ─── Queue singleton ──────────────────────────────────────────────────────────

export const EMAIL_QUEUE_NAME = 'email';

const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, getQueueOptions());

// ─── Job helpers ──────────────────────────────────────────────────────────────

export async function addWelcomeEmailJob(
  userId: string,
  email: string,
  name?: string,
): Promise<void> {
  await emailQueue.add(
    'welcome',
    { type: 'welcome', userId, email, name },
    { jobId: `welcome-${userId}`, delay: 2000 }, // slight delay to let DB commit settle
  );
}

export async function addPasswordResetEmailJob(
  userId: string,
  email: string,
  resetLink: string,
): Promise<void> {
  await emailQueue.add('password_reset', {
    type: 'password_reset',
    userId,
    email,
    resetLink,
  });
}

export async function addStoreOtpJob(
  email: string,
  otp: string,
  storeName?: string,
): Promise<void> {
  await emailQueue.add('store_otp', { type: 'store_otp', email, otp, storeName });
}

export default emailQueue;
