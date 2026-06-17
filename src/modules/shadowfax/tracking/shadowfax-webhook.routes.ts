import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import shadowfaxWebhookController from './shadowfax-webhook.controller';
import {
  shadowfaxRiderLocationWebhookSchema,
  shadowfaxStatusWebhookSchema,
} from './shadowfax-webhook.schema';

const WEBHOOK_RATE_MAX = parseInt(process.env.SHADOWFAX_WEBHOOK_RATE_LIMIT_MAX ?? '300', 10);
const WEBHOOK_RATE_WINDOW_MS = parseInt(
  process.env.SHADOWFAX_WEBHOOK_RATE_LIMIT_WINDOW_MS ?? '60000',
  10,
);

export default async function shadowfaxWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(rateLimit, {
    max: WEBHOOK_RATE_MAX,
    timeWindow: WEBHOOK_RATE_WINDOW_MS,
    keyGenerator: (request) => request.ip,
  });

  fastify.post(
    '/shadowfax',
    { schema: shadowfaxStatusWebhookSchema },
    shadowfaxWebhookController.handleStatus.bind(shadowfaxWebhookController),
  );

  fastify.post(
    '/shadowfax/rider-location',
    { schema: shadowfaxRiderLocationWebhookSchema },
    shadowfaxWebhookController.handleRiderLocation.bind(shadowfaxWebhookController),
  );
}
