import { FastifyRequest, FastifyReply } from 'fastify';
import userService, { AdminUserListFilters } from './user.service';
import { Roles } from './user.model';

interface UserParams {
  userId: string;
}

class AdminUserController {
  async list(
    request: FastifyRequest<{ Querystring: AdminUserListFilters }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { role, ...rest } = request.query;
    const result = await userService.listForAdmin({
      ...rest,
      ...(role ? { role: role as Roles } : {}),
    });
    void reply.status(200).send({ success: true, data: result });
  }

  async getOne(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const user = await userService.getByIdForAdmin(request.params.userId);
    void reply.status(200).send({ success: true, data: { user } });
  }
}

export default new AdminUserController();
