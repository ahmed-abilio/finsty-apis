import { FastifyRequest } from 'fastify';
import { AppError } from '@utils/appError';
import logger from '@utils/logger';

export function validateShadowfaxWebhookAuth(request: FastifyRequest): void {
  const secret = process.env.SHADOWFAX_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('SHADOWFAX_WEBHOOK_SECRET not set in production');
    }
    return;
  }

  const headerName = (process.env.SHADOWFAX_WEBHOOK_HEADER_NAME ?? 'x-shadowfax-secret').toLowerCase();
  const provided = String(request.headers[headerName] ?? '').trim();

  if (!provided || provided !== secret) {
    logger.warn({ ip: request.ip, url: request.url }, 'shadowfax_webhook_unauthorized');
    throw AppError.unauthorized('Invalid webhook secret', 'WEBHOOK_UNAUTHORIZED');
  }
}
