import { describe, it, expect } from 'vitest';
import {
  extractCancellationFromOrder,
  extractRiderDetailsFromOrder,
} from './orderDeliveryPresentation';

describe('orderDeliveryPresentation', () => {
  it('extracts rider details with location from delivery metadata', () => {
    const result = extractRiderDetailsFromOrder({
      riderId: 42,
      riderName: 'Aastha Jain',
      riderPhone: '8750879029',
      deliveryMetadata: {
        rider_location: { latitude: '12.93', longitude: '77.62' },
      },
    });

    expect(result).toEqual({
      id: 42,
      name: 'Aastha Jain',
      phone: '8750879029',
      location: { latitude: '12.93', longitude: '77.62' },
    });
  });

  it('returns null when no rider data exists', () => {
    expect(
      extractRiderDetailsFromOrder({
        riderId: null,
        riderName: null,
        riderPhone: null,
        deliveryMetadata: null,
      }),
    ).toBeNull();
  });

  it('extracts cancellation with status label and detail text', () => {
    const result = extractCancellationFromOrder({
      status: 'cancelled',
      cancelledAt: new Date('2026-06-23T08:00:00Z'),
      deliveryMetadata: {
        shadowfax_cancel_status: 'CANCELLED_BY_CUSTOMER',
        cancel_reason_code: '1',
        cancel_reason_text: 'Damaged products',
      },
    });

    expect(result).toEqual({
      cancelledAt: '2026-06-23T08:00:00.000Z',
      reason: 'Cancelled by Customer',
      reasonText: 'Damaged products',
    });
  });

  it('falls back to legacy webhook cancel_reason label', () => {
    const result = extractCancellationFromOrder({
      status: 'cancelled',
      cancelledAt: new Date('2026-06-23T08:00:00Z'),
      deliveryMetadata: {
        cancel_reason: 'RIDER_ISSUE',
        cancel_reason_text: 'Rider unavailable',
      },
    });

    expect(result).toEqual({
      cancelledAt: '2026-06-23T08:00:00.000Z',
      reason: 'RIDER_ISSUE',
      reasonText: 'Rider unavailable',
    });
  });

  it('returns null cancellation when order is not cancelled and no metadata', () => {
    expect(
      extractCancellationFromOrder({
        status: 'confirmed',
        cancelledAt: null,
        deliveryMetadata: null,
      }),
    ).toBeNull();
  });
});
