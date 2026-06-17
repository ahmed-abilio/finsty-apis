import { FastifyInstance } from 'fastify';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@utils/appError';
import { Roles } from '@modules/user/user.model';
import {
  getShadowfaxDevLocalCallbackConfig,
  updateShadowfaxDevLocalCallbackConfig,
} from './platform-settings.service';

class PlatformSettingsAdminController {
  async getShadowfaxDevLocalCallback(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    void reply.status(200).send({
      success: true,
      data: await getShadowfaxDevLocalCallbackConfig(),
    });
  }

  async patchShadowfaxDevLocalCallback(
    request: FastifyRequest<{ Body: { enabled?: boolean; baseUrl?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      throw AppError.forbidden(
        'Shadowfax local callback settings are only available in development',
        'DEV_ONLY_SETTING',
      );
    }

    const data = await updateShadowfaxDevLocalCallbackConfig(request.body ?? {});
    void reply.status(200).send({ success: true, data });
  }
}

const controller = new PlatformSettingsAdminController();

export default async function platformSettingsAdminRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  fastify.get(
    '/shadowfax-dev-local-callback',
    {
      schema: {
        tags: ['Admin', 'Config'],
        summary: 'Get Shadowfax local callback dev settings (DB)',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  baseUrl: { type: 'string' },
                  webhookUrl: { type: 'string' },
                  developmentOnly: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    controller.getShadowfaxDevLocalCallback.bind(controller),
  );

  fastify.patch(
    '/shadowfax-dev-local-callback',
    {
      schema: {
        tags: ['Admin', 'Config'],
        summary: 'Enable/disable Shadowfax local callback sync in development',
        body: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            baseUrl: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    controller.patchShadowfaxDevLocalCallback.bind(controller),
  );
}
