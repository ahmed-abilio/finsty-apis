import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { getWorkerOptions } from '@config/bullmq';
import { EmailJobData, EMAIL_QUEUE_NAME } from './emailQueue';
import logger from '@utils/logger';

// ─── Job processors ───────────────────────────────────────────────────────────

async function processWelcomeEmail(job: Job<EmailJobData>): Promise<void> {
  if (job.data.type !== 'welcome') return;
  const { userId, email } = job.data;

  logger.info({ jobId: job.id, userId, email }, 'Processing welcome email');

  // TODO: integrate your email provider (SES, SendGrid, Resend, etc.)
  // Example with a hypothetical emailClient:
  //
  // await emailClient.send({
  //   to: email,
  //   subject: 'Welcome to finsty!',
  //   template: 'welcome',
  //   variables: { name: name ?? 'there' },
  // });

  // Simulate async work
  await new Promise((resolve) => setTimeout(resolve, 100));
  logger.info({ jobId: job.id, userId }, 'Welcome email sent');
}

async function processPasswordResetEmail(job: Job<EmailJobData>): Promise<void> {
  if (job.data.type !== 'password_reset') return;
  const { userId, email } = job.data;

  logger.info({ jobId: job.id, userId, email }, 'Processing password reset email');

  // TODO: integrate your email provider
  // await emailClient.send({ to: email, template: 'password_reset', variables: { resetLink } });

  await new Promise((resolve) => setTimeout(resolve, 100));
  logger.info({ jobId: job.id, userId }, 'Password reset email sent');
}

async function processStoreOtpEmail(job: Job<EmailJobData>): Promise<void> {
  if (job.data.type !== 'store_otp') return;
  const { email, otp: _otp, storeName: _storeName } = job.data;

  logger.info({ jobId: job.id, email }, 'Processing store OTP email');

  // TODO: integrate your email provider
  // await emailClient.send({ to: email, template: 'store_otp', variables: { otp, storeName } });

  await new Promise((resolve) => setTimeout(resolve, 100));
  logger.info({ jobId: job.id, email }, 'Store OTP email sent');
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    switch (job.data.type) {
      case 'welcome':
        await processWelcomeEmail(job);
        break;
      case 'password_reset':
        await processPasswordResetEmail(job);
        break;
      case 'store_otp':
        await processStoreOtpEmail(job);
        break;
      default: {
        const _exhaustive: never = job.data;
        void _exhaustive; // Silence unused variable error
        logger.warn({ jobId: job.id }, 'Unknown job type, skipping');
      }
    }
  },
  getWorkerOptions(),
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, name: job.name }, 'Email job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, name: job?.name, err }, 'Email job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Email worker error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down email worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down email worker...');
  await worker.close();
  process.exit(0);
});

logger.info('Email worker started');

export default worker;
