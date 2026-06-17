import { describe, it, expect } from 'vitest';
import { resolveShadowfaxOrderId } from './orderShadowfax';

describe('orderShadowfax', () => {
  it('resolves shadowfax order id from preloaded map', () => {
    const map = new Map<string, string | null>([
      ['order-1', 'SFX-991'],
      ['order-2', null],
    ]);

    expect(resolveShadowfaxOrderId('order-1', map)).toBe('SFX-991');
    expect(resolveShadowfaxOrderId('order-2', map)).toBeNull();
  });

  it('returns null when map is missing', () => {
    expect(resolveShadowfaxOrderId('order-1')).toBeNull();
  });
});
