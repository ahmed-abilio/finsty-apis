import { FastifyRequest, FastifyReply } from 'fastify';
import cmsService from './cms.service';
import type { CmsListFilters, CmsReadFilters, CreateCmsPageInput, UpdateCmsPageInput } from './cms.types';
import { Roles } from '@modules/user/user.model';

interface CmsParams {
  id: string;
}

class CmsController {
  async listPublished(
    request: FastifyRequest<{ Querystring: CmsReadFilters }>,
    reply: FastifyReply,
  ): Promise<void> {
    const role = (request.user.role as Roles) || Roles.USER;
    const rows = await cmsService.listPublished(request.query ?? {}, role);
    void reply.status(200).send({
      success: true,
      data: { items: rows.map((r) => r.toPublicJSON()) },
    });
  }

  async adminList(
    request: FastifyRequest<{ Querystring: CmsListFilters }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await cmsService.adminList(request.query ?? {});
    void reply.status(200).send({
      success: true,
      data: {
        items: result.items.map((r) => r.toPublicJSON()),
        pagination: result.pagination,
      },
    });
  }

  async adminGetById(
    request: FastifyRequest<{ Params: CmsParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const row = await cmsService.getById(request.params.id);
    void reply.status(200).send({ success: true, data: { page: row.toPublicJSON() } });
  }

  async create(
    request: FastifyRequest<{ Body: CreateCmsPageInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const row = await cmsService.create(request.body);
    void reply.status(201).send({ success: true, data: { page: row.toPublicJSON() } });
  }

  async update(
    request: FastifyRequest<{ Params: CmsParams; Body: UpdateCmsPageInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const row = await cmsService.update(request.params.id, request.body);
    void reply.status(200).send({ success: true, data: { page: row.toPublicJSON() } });
  }

  async remove(request: FastifyRequest<{ Params: CmsParams }>, reply: FastifyReply): Promise<void> {
    await cmsService.remove(request.params.id);
    void reply.status(200).send({
      success: true,
      data: { message: 'CMS page deleted' },
    });
  }
}

export default new CmsController();
