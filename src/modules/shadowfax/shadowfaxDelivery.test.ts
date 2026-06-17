import { describe, it, expect } from 'vitest';
import {
  parseShadowfaxServiceabilityPayload,
  buildShadowfaxReplayFromSubtotal,
} from './shadowfaxDelivery';

describe('parseShadowfaxServiceabilityPayload', () => {
  it('reads nested rider_cost and is_serviceable', () => {
    const parsed = parseShadowfaxServiceabilityPayload({
      success: true,
      data: { is_serviceable: true, rider_cost: 42.5 },
    });
    expect(parsed.serviceable).toBe(true);
    expect(parsed.deliveryFee).toBe(42.5);
  });

  it('unwraps success wrapper', () => {
    const parsed = parseShadowfaxServiceabilityPayload({
      success: true,
      data: { serviceable: true, delivery_charge: '39.00' },
    });
    expect(parsed.serviceable).toBe(true);
    expect(parsed.deliveryFee).toBe(39);
  });

  it('treats non_serviceable as not serviceable', () => {
    const parsed = parseShadowfaxServiceabilityPayload({
      data: { non_serviceable: true, rider_cost: 10 },
    });
    expect(parsed.serviceable).toBe(false);
  });
});

describe('buildShadowfaxReplayFromSubtotal', () => {
  it('formats order value to two decimals', () => {
    const r = buildShadowfaxReplayFromSubtotal(199.9, 'true');
    expect(r.orderValue).toBe('199.90');
    expect(r.paid).toBe('true');
  });
});
