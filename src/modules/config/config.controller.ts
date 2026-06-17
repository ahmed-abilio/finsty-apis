import { FastifyReply, FastifyRequest } from 'fastify';
import { getPublicDeliveryConfig } from '@config/delivery.config';

class ConfigController {
  async getDeliveryConfig(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    void reply.status(200).send({ success: true, data: getPublicDeliveryConfig() });
  }
}

export default new ConfigController();
