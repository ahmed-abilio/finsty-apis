import { FastifySchema } from 'fastify';

const webhookSuccess = {
  type: 'object',
  properties: { success: { type: 'boolean' } },
} as const;

const shadowfaxWebhookBody = {
  type: 'object',
  additionalProperties: true,
  properties: {
    client_order_id: { type: 'string' },
    order_status: { type: 'string' },
    status: { type: 'string' },
    sfx_order_id: { type: ['number', 'string'] },
    event_time: { type: 'string' },
    delivery_time: { type: 'string' },
    cancel_time: { type: 'string' },
    rts_time: { type: 'string' },
    cancel_reason: { type: 'string' },
    cancel_reason_text: { type: 'string' },
    drop_image_url: { type: 'string' },
    rider_id: { type: ['number', 'string'] },
    rider_name: { type: 'string' },
    rider_phone: { type: 'string' },
    rider_details: {
      type: 'object',
      additionalProperties: true,
      properties: {
        rider_name: { type: 'string' },
        rider_phone: { type: 'string' },
        rider_id: { type: ['number', 'string'] },
      },
    },
    order_details: {
      type: 'object',
      additionalProperties: true,
      properties: {
        client_order_id: { type: 'string' },
        delivery_time: { type: 'string' },
      },
    },
  },
} as const;

export const shadowfaxStatusWebhookSchema: FastifySchema = {
  tags: ['Webhooks'],
  summary: 'Shadowfax order status webhook',
  description:
    'Receives Shadowfax delivery status callbacks. Idempotent by `eventKey`. ' +
    'Returns 200 immediately; processing is async via BullMQ. ' +
    'Optional auth header: `SHADOWFAX_WEBHOOK_HEADER_NAME` (default `x-shadowfax-secret`).',
  body: shadowfaxWebhookBody,
  response: { 200: webhookSuccess },
};

export const shadowfaxRiderLocationWebhookSchema: FastifySchema = {
  tags: ['Webhooks'],
  summary: 'Shadowfax rider location webhook',
  description: 'Stores rider GPS updates for an order (24h retention).',
  body: {
    type: 'object',
    required: ['client_order_id', 'latitude', 'longitude'],
    additionalProperties: true,
    properties: {
      client_order_id: { type: 'string' },
      latitude: { type: ['number', 'string'] },
      longitude: { type: ['number', 'string'] },
      timestamp: { type: 'string' },
      pickup_eta: { type: 'number' },
      drop_eta: { type: 'number' },
      sfx_order_id: { type: ['number', 'string'] },
    },
  },
  response: { 200: webhookSuccess },
};
