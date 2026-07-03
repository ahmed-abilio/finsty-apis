import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@utils/appError';
import dashboardService from './dashboard.service';
import { resolveDashboardDateRange } from './dashboard.utils';

export interface DashboardQuery {
  from?: string;
  to?: string;
}

class DashboardController {
  async getDashboard(
    request: FastifyRequest<{ Querystring: DashboardQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { from, to } = request.query;

    let range;
    try {
      range = resolveDashboardDateRange(from, to);
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'INVALID_DATE_RANGE') {
        throw AppError.badRequest('from and to are both required when either is provided', 'INVALID_DATE_RANGE');
      }
      const code = message === 'INVALID_RANGE' ? 'INVALID_DATE_RANGE' : 'INVALID_DATE';
      const detail =
        message === 'INVALID_RANGE'
          ? 'to must be greater than or equal to from'
          : 'from and to must be valid ISO timestamps or YYYY-MM-DD dates';
      throw AppError.badRequest(detail, code);
    }

    const data = await dashboardService.getDashboard(range);
    void reply.status(200).send({ success: true, data });
  }
}

export default new DashboardController();
