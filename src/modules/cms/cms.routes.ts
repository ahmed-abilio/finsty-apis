import { FastifyInstance } from 'fastify';
import cmsController from './cms.controller';
import {
  listCmsPagesSchema,
  adminListCmsPagesSchema,
  adminGetCmsPageSchema,
  createCmsPageSchema,
  updateCmsPageSchema,
  deleteCmsPageSchema,
} from './cms.schema';
import { Roles } from '@modules/user/user.model';
import type { CreateCmsPageInput, UpdateCmsPageInput, CmsListFilters, CmsReadFilters } from './cms.types';

interface CmsParams {
  id: string;
}

export async function cmsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get<{ Querystring: CmsReadFilters }>(
    '/',
    { schema: listCmsPagesSchema },
    cmsController.listPublished.bind(cmsController),
  );
}

export async function adminCmsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.requireRole(Roles.ADMIN));

  fastify.get<{ Querystring: CmsListFilters }>(
    '/',
    { schema: adminListCmsPagesSchema },
    cmsController.adminList.bind(cmsController),
  );

  fastify.get<{ Params: CmsParams }>(
    '/:id',
    { schema: adminGetCmsPageSchema },
    cmsController.adminGetById.bind(cmsController),
  );

  fastify.post<{ Body: CreateCmsPageInput }>(
    '/',
    { schema: createCmsPageSchema },
    cmsController.create.bind(cmsController),
  );

  fastify.patch<{ Params: CmsParams; Body: UpdateCmsPageInput }>(
    '/:id',
    { schema: updateCmsPageSchema },
    cmsController.update.bind(cmsController),
  );

  fastify.delete<{ Params: CmsParams }>(
    '/:id',
    { schema: deleteCmsPageSchema },
    cmsController.remove.bind(cmsController),
  );
}
