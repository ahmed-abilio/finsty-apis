import { FastifyReply, FastifyRequest } from 'fastify';
import { getPublicAppConfig } from './platform-settings.service';

class PlatformSettingsPublicController {
  async getPublic(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    void reply.status(200).send({
      success: true,
      data: await getPublicAppConfig(),
    });
  }
}

export default new PlatformSettingsPublicController();
