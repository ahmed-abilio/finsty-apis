import { FastifySchema } from 'fastify';

export const getDeliveryConfigSchema: FastifySchema = {
  tags: ['Config'],
  summary: 'Delivery pricing rules for checkout',
  description:
    'Returns delivery pricing rules. Free delivery requires a FREE_DELIVERY coupon. ' +
    'Use GET /cart/delivery-quote for the payable total including Shadowfax fees.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            freeDeliveryRequiresCoupon: { type: 'boolean' },
          },
        },
      },
    },
  },
};
