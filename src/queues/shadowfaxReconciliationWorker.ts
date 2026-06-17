import 'dotenv/config';
import { Worker } from 'bullmq';
import { getScheduledJobWorkerOptions } from '@config/bullmq';
import {
  SHADOWFAX_RECONCILIATION_JOB_NAME,
  SHADOWFAX_RECONCILIATION_QUEUE_NAME,
} from './shadowfaxReconciliationQueue';
import { runShadowfaxReconciliation } from '@modules/shadowfax/tracking/shadowfax-reconciliation.service';
import logger from '@utils/logger';

const worker = new Worker(
  SHADOWFAX_RECONCILIATION_QUEUE_NAME,
  async (job, _token, signal) => {
    if (job.name !== SHADOWFAX_RECONCILIATION_JOB_NAME) return;
    const result = await runShadowfaxReconciliation(signal);
    logger.info({ jobId: job.id, ...result }, 'Shadowfax reconciliation completed');
  },
  getScheduledJobWorkerOptions(),
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Shadowfax reconciliation job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Shadowfax reconciliation worker failed');
});

worker.on('lockRenewalFailed', (jobIds) => {
  for (const jobId of jobIds) {
    logger.warn({ jobId }, 'Shadowfax reconciliation lock renewal failed; cancelling job');
    worker.cancelJob(jobId, 'lock renewal failed');
  }
});

worker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Shadowfax reconciliation job stalled');
});

worker.on('error', (err) => {
  if (err.message.startsWith('could not renew lock for job ')) {
    return;
  }
  logger.error({ err }, 'Shadowfax reconciliation worker error');
});

async function shutdownWorker(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down Shadowfax reconciliation worker...');
  await worker.close();
}

process.on('SIGTERM', () => void shutdownWorker('SIGTERM'));
process.on('SIGINT', () => void shutdownWorker('SIGINT'));

logger.info('Shadowfax reconciliation worker started');

export default worker;
