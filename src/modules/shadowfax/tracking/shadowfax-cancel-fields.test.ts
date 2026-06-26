import { describe, it, expect } from 'vitest';
import {
  extractShadowfaxCancelFields,
  mapShadowfaxCancelStatusToLabel,
} from './shadowfax-cancel-fields';
import { shadowfaxStatusDataToWebhookPayload } from './shadowfax-dev-local-callback.service';

describe('shadowfax-cancel-fields', () => {
  it('reads reason code and reason_text from Shadowfax status API shape', () => {
    expect(
      extractShadowfaxCancelFields({
        status: 'CANCELLED_BY_CUSTOMER',
        reason: 1,
        reason_text: 'Damaged products',
      }),
    ).toEqual({
      cancelReasonCode: '1',
      cancelReasonText: 'Damaged products',
      shadowfaxCancelStatus: 'CANCELLED_BY_CUSTOMER',
    });
  });

  it('maps any Shadowfax cancel status code to a human-readable reason label', () => {
    expect(mapShadowfaxCancelStatusToLabel('CANCELLED_BY_CUSTOMER')).toBe(
      'Cancelled by Customer',
    );
    expect(mapShadowfaxCancelStatusToLabel('CANCELLED_BY_RIDER')).toBe(
      'Cancelled by Rider',
    );
    expect(mapShadowfaxCancelStatusToLabel('CANCELLED_BY_OPS_TEAM')).toBe(
      'Cancelled by Ops Team',
    );
    expect(mapShadowfaxCancelStatusToLabel('CANCELLED')).toBe('Cancelled');
  });

  it('prefers reason_text over legacy cancel_reason_text fields', () => {
    expect(
      extractShadowfaxCancelFields({
        cancel_reason_text: 'Legacy text',
        reason_text: 'Damaged products',
      }),
    ).toEqual({
      cancelReasonCode: null,
      cancelReasonText: 'Damaged products',
      shadowfaxCancelStatus: null,
    });
  });
});

describe('shadowfaxStatusDataToWebhookPayload cancel fields', () => {
  it('maps top-level reason fields into webhook payload', () => {
    const payload = shadowfaxStatusDataToWebhookPayload({
      client_code: 'merchant001',
      status: 'CANCELLED_BY_CUSTOMER',
      sfx_order_id: 21043840,
      order_details: {
        client_order_id: 'order-uuid',
        order_value: 100,
        scheduled_time: '2026-06-23T07:22:45Z',
        paid: 'true',
        preparation_time: 0,
        pickup_eta: null,
        drop_eta: null,
        allot_time: null,
        arrival_time: null,
        dispatch_time: null,
        delivery_time: null,
        vehicle_number: null,
        order_date: '2026-06-23',
        last_update_time: '2026-06-23T07:32:16Z',
      },
      drop_details: {} as never,
      order_items: [],
      track_url: null,
      pickup_details: {} as never,
      reason: 1,
      reason_text: 'Damaged products',
    });

    expect(payload.cancel_reason).toBe('Cancelled by Customer');
    expect(payload.reason).toBe('1');
    expect(payload.reason_text).toBe('Damaged products');
    expect(payload.cancel_reason_text).toBe('Damaged products');
    expect(payload.cancel_time).toBe('2026-06-23T07:32:16Z');
  });
});
