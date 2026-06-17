import { FastifyInstance } from 'fastify';
import userController from './user.controller';
import {
  getMeSchema,
  updateMeSchema,
  deleteMeSchema,
  confirmAvatarSchema,
  registerDeviceTokenSchema,
} from './user.schema';

export default async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // All user routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/me', { schema: getMeSchema }, userController.getMe.bind(userController));

  fastify.patch(
    '/me',
    { schema: updateMeSchema },
    userController.updateMe.bind(userController),
  );

  fastify.delete(
    '/me',
    { schema: deleteMeSchema },
    userController.deleteMe.bind(userController),
  );

  fastify.patch(
    '/me/avatar',
    { schema: confirmAvatarSchema },
    userController.confirmAvatarUpload.bind(userController),
  );

  fastify.put(
    '/me/device-token',
    { schema: registerDeviceTokenSchema },
    userController.registerDeviceToken.bind(userController),
  );
}
