import { FastifyInstance } from 'fastify';
import platformSettingsPublicController from './platform-settings.public.controller';
import { getPublicPlatformSettingsSchema } from './platform-settings.schema';

export default async function platformSettingsPublicRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get(
    '/public',
    { schema: getPublicPlatformSettingsSchema },
    platformSettingsPublicController.getPublic.bind(platformSettingsPublicController),
  );
}
