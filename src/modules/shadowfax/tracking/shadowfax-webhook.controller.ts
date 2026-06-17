import { FastifyReply, FastifyRequest } from 'fastify';
import { validateShadowfaxWebhookAuth } from './shadowfax-webhook-auth';
import {
  ingestShadowfaxRiderLocation,
  ingestShadowfaxStatusWebhook,
} from './shadowfax-webhook.service';
import type {
  ShadowfaxRiderLocationPayload,
  ShadowfaxWebhookPayload,
} from './shadowfax-webhook.types';

class ShadowfaxWebhookController {
  async handleStatus(
    request: FastifyRequest<{ Body: ShadowfaxWebhookPayload }>,
    reply: FastifyReply,
  ): Promise<void> {
    validateShadowfaxWebhookAuth(request);
    await ingestShadowfaxStatusWebhook(request.body);
    void reply.status(200).send({ success: true });
  }

  async handleRiderLocation(
    request: FastifyRequest<{ Body: ShadowfaxRiderLocationPayload }>,
    reply: FastifyReply,
  ): Promise<void> {
    validateShadowfaxWebhookAuth(request);
    await ingestShadowfaxRiderLocation(request.body);
    void reply.status(200).send({ success: true });
  }
}

export default new ShadowfaxWebhookController();
