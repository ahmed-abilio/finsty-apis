import { FastifySchema } from 'fastify';

const adminContactObject = {
  type: 'object',
  properties: {
    email: { type: 'string', nullable: true, format: 'email' },
    mobileNumber: { type: 'string', nullable: true },
  },
} as const;

// ─── GET /admin/me ────────────────────────────────────────────────────────────

export const getAdminMeSchema: FastifySchema = {
  tags: ['Admin'],
  summary: 'Get signed-in admin contact details',
  description: 'Returns the email and mobile number of the authenticated admin account.',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: adminContactObject,
      },
    },
  },
};
