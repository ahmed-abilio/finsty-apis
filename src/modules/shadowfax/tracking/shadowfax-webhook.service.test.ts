import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetShadowfaxMetricsForTests } from '@observability/shadowfax.metrics';

vi.mock('./shadowfax-webhook-event.repository', () => ({
  insertWebhookEventIfNotExists: vi.fn(),
}));

vi.mock('@queues/shadowfaxQueue', () => ({
  enqueueShadowfaxJob: vi.fn(),
}));

vi.mock('./order-lookup.service', () => ({
  resolveOrderByClientOrderId: vi.fn(),
}));

vi.mock('./order-rider-location.repository', () => ({
  insertRiderLocation: vi.fn(),
}));

import { insertWebhookEventIfNotExists } from './shadowfax-webhook-event.repository';
import { enqueueShadowfaxJob } from '@queues/shadowfaxQueue';
import {
  ingestShadowfaxRiderLocation,
  ingestShadowfaxStatusWebhook,
} from './shadowfax-webhook.service';
import { resolveOrderByClientOrderId } from './order-lookup.service';
import { insertRiderLocation } from './order-rider-location.repository';

const insertEvent = vi.mocked(insertWebhookEventIfNotExists);
const enqueue = vi.mocked(enqueueShadowfaxJob);
const resolveOrder = vi.mocked(resolveOrderByClientOrderId);
const insertLocation = vi.mocked(insertRiderLocation);

describe('shadowfax-webhook.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetShadowfaxMetricsForTests();
  });

  it('enqueues new webhook events', async () => {
    insertEvent.mockResolvedValue({
      inserted: true,
      event: { id: 'evt-1' } as never,
    });

    const result = await ingestShadowfaxStatusWebhook({
      client_order_id: 'order-uuid',
      order_status: 'DELIVERED',
      delivery_time: '2026-01-28T14:45:53Z',
    });

    expect(result.duplicate).toBe(false);
    expect(enqueue).toHaveBeenCalledWith({ type: 'process_shadowfax_webhook', eventId: 'evt-1' });
  });

  it('skips duplicate webhook events', async () => {
    insertEvent.mockResolvedValue({
      inserted: false,
      event: { id: 'evt-dup' } as never,
    });

    const result = await ingestShadowfaxStatusWebhook({
      client_order_id: 'order-uuid',
      order_status: 'DELIVERED',
      delivery_time: '2026-01-28T14:45:53Z',
    });

    expect(result.duplicate).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('stores rider location', async () => {
    resolveOrder.mockResolvedValue({ id: 'order-1' } as never);

    await ingestShadowfaxRiderLocation({
      client_order_id: 'order-1',
      latitude: 12.97,
      longitude: 77.59,
      pickup_eta: 10,
      drop_eta: 20,
    });

    expect(insertLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        latitude: 12.97,
        longitude: 77.59,
      }),
    );
  });
});
