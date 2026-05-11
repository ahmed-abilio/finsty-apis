import { FastifyInstance } from 'fastify';
import mediaController from './media.controller';
import { presignedUploadSchema, deleteMediaSchema } from './media.schema';

export default async function mediaRoutes(fastify: FastifyInstance): Promise<void> {
  // fastify.addHook('onRequest', fastify.authenticate);
  // fastify.optionalAuthenticate('');
  fastify.get(
    '/presigned-upload',
    { schema: presignedUploadSchema ,onRequest: [fastify.optionalAuthenticate]},
    mediaController.getPresignedUpload.bind(mediaController) as any,
  );

  fastify.delete(
    '/',
    { schema: deleteMediaSchema ,onRequest: [fastify.authenticate]},
    mediaController.deleteMedia.bind(mediaController) as any,
  );
}
