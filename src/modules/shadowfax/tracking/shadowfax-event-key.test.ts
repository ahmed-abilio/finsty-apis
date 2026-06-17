import { describe, it, expect } from 'vitest';
import { buildShadowfaxEventKey } from './shadowfax-event-key';

describe('shadowfax-event-key', () => {
  it('builds stable event key from client order id, status and timestamp', () => {
    const key = buildShadowfaxEventKey({
      client_order_id: '6959117701',
      order_status: 'DELIVERED',
      delivery_time: '2026-01-28T14:45:53Z',
    });
    expect(key).toBe('6959117701_DELIVERED_2026-01-28T14:45:53.000Z');
  });
});
