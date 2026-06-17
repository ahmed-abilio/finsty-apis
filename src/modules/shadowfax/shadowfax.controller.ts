import { FastifyReply, FastifyRequest } from 'fastify';
import shadowfaxService from './shadowfax.service';
import { OrderServiceabilityRequest } from './shadowfax.client';

class ShadowfaxController {
  async checkOrderServiceability(
    request: FastifyRequest<{ Body: OrderServiceabilityRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await shadowfaxService.checkOrderServiceability(request.body);
    void reply.status(200).send(result);
  }
}

export default new ShadowfaxController();
