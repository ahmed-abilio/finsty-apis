import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./order-status-transition.service', () => ({
  transitionOrderStatus: vi.fn(),
}));

vi.mock('./shadowfax-webhook-event.repository', () => ({
  findWebhookEventById: vi.fn(),
  markWebhookEventProcessed: vi.fn(),
}));

vi.mock('./order-lookup.service', () => ({
  resolveOrderByClientOrderId: vi.fn(),
  resolveOrderReturnByClientOrderId: vi.fn(),
}));

vi.mock('./order-return-shadowfax.processor', () => ({
  processReturnShadowfaxWebhook: vi.fn(),
}));

import { transitionOrderStatus } from './order-status-transition.service';
import { findWebhookEventById, markWebhookEventProcessed } from './shadowfax-webhook-event.repository';
import {
  resolveOrderByClientOrderId,
  resolveOrderReturnByClientOrderId,
} from './order-lookup.service';
import { processReturnShadowfaxWebhook } from './order-return-shadowfax.processor';
import { processShadowfaxWebhookEvent } from './shadowfax-webhook.processor';

const transition = vi.mocked(transitionOrderStatus);
const findEvent = vi.mocked(findWebhookEventById);
const markProcessed = vi.mocked(markWebhookEventProcessed);
const resolveOrder = vi.mocked(resolveOrderByClientOrderId);
const resolveReturn = vi.mocked(resolveOrderReturnByClientOrderId);
const processReturn = vi.mocked(processReturnShadowfaxWebhook);

const deliveredPayload = {
  client_order_id: 'order-1',
  order_status: 'DELIVERED',
  delivery_time: '2026-01-28T14:45:53Z',
  sfx_order_id: 21042908,
};

describe('shadowfax-webhook.processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveReturn.mockResolvedValue(null);
  });

  it('routes return client_order_id to return processor', async () => {
    findEvent.mockResolvedValue({
      id: 'evt-return',
      processed: false,
      payload: {
        client_order_id: 'return-uuid',
        order_status: 'DELIVERED',
      },
    } as never);
    resolveReturn.mockResolvedValue({ id: 'return-uuid' } as never);
    processReturn.mockResolvedValue({ applied: true });

    await processShadowfaxWebhookEvent('evt-return');

    expect(processReturn).toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
    expect(markProcessed).toHaveBeenCalledWith('evt-return', null);
  });

  it('DELIVERED webhook updates order', async () => {
    findEvent.mockResolvedValue({
      id: 'evt-1',
      processed: false,
      payload: deliveredPayload,
    } as never);
    resolveOrder.mockResolvedValue({
      id: 'order-1',
      deliveryMetadata: null,
    } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'arrived',
      newStatus: 'delivered',
    });

    await processShadowfaxWebhookEvent('evt-1');

    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        toStatus: 'delivered',
        source: 'shadowfax_webhook',
      }),
    );
    expect(markProcessed).toHaveBeenCalledWith('evt-1', null);
  });

  it('marks invalid transition without throwing', async () => {
    findEvent.mockResolvedValue({
      id: 'evt-2',
      processed: false,
      payload: { ...deliveredPayload, order_status: 'DISPATCHED' },
    } as never);
    resolveOrder.mockResolvedValue({ id: 'order-1', deliveryMetadata: null } as never);
    transition.mockResolvedValue({
      applied: false,
      order: {} as never,
      oldStatus: 'delivered',
      newStatus: 'delivered',
      reason: 'invalid_transition',
    });

    await processShadowfaxWebhookEvent('evt-2');

    expect(markProcessed).toHaveBeenCalledWith(
      'evt-2',
      expect.stringContaining('invalid_transition'),
    );
  });

  it('CANCELLED webhook updates order metadata', async () => {
    findEvent.mockResolvedValue({
      id: 'evt-3',
      processed: false,
      payload: {
        client_order_id: 'order-1',
        order_status: 'CANCELLED',
        cancel_time: '2026-01-28T15:00:00Z',
        cancel_reason: 'RIDER_ISSUE',
      },
    } as never);
    resolveOrder.mockResolvedValue({ id: 'order-1', deliveryMetadata: null } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'rider_assigned',
      newStatus: 'cancelled',
    });

    await processShadowfaxWebhookEvent('evt-3');

    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: 'cancelled' }),
    );
  });

  it('RETURNED_TO_SELLER webhook updates order', async () => {
    findEvent.mockResolvedValue({
      id: 'evt-4',
      processed: false,
      payload: {
        client_order_id: 'order-1',
        order_status: 'RETURNED_TO_SELLER',
        rts_time: '2026-01-28T16:00:00Z',
      },
    } as never);
    resolveOrder.mockResolvedValue({ id: 'order-1', deliveryMetadata: null } as never);
    transition.mockResolvedValue({
      applied: true,
      order: {} as never,
      oldStatus: 'delivered',
      newStatus: 'returned',
    });

    await processShadowfaxWebhookEvent('evt-4');

    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: 'returned' }),
    );
  });
});
