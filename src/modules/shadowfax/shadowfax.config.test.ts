import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCancelOrderUrl,
  getDispatchReadyUrl,
  getOrderServiceabilityUrl,
  getOrderStatusUrl,
  getPlaceOrderUrl,
} from './shadowfax.config';

const PROXY_BASE = 'https://private-anon-3e6934dd12-sfxhlmarketplaceapi.apiary-proxy.com';

function setShadowfaxEnv(): void {
  process.env.SHADOWFAX_API_KEY = 'test-token';
  process.env.SHADOWFAX_SERVICEABILITY_URL = `${PROXY_BASE}/api/v1/order-serviceability/`;
  process.env.SHADOWFAX_PLACE_ORDER_URL = `${PROXY_BASE}/api/v2/orders/`;
  process.env.SHADOWFAX_ORDER_STATUS_URL = `${PROXY_BASE}/api/v2/orders/{id}/status/`;
}

describe('shadowfax.config URLs (env only)', () => {
  const snapshot = { ...process.env };

  beforeEach(() => {
    process.env = { ...snapshot };
    delete process.env.SHADOWFAX_SERVICEABILITY_URL;
    delete process.env.SHADOWFAX_PLACE_ORDER_URL;
    delete process.env.SHADOWFAX_ORDER_STATUS_URL;
    delete process.env.SHADOWFAX_BASE_URL;
    delete process.env.SHADOWFAX_V2_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('getOrderServiceabilityUrl uses SHADOWFAX_SERVICEABILITY_URL', () => {
    setShadowfaxEnv();
    expect(getOrderServiceabilityUrl()).toBe(`${PROXY_BASE}/api/v1/order-serviceability/`);
  });

  it('getPlaceOrderUrl uses SHADOWFAX_PLACE_ORDER_URL', () => {
    setShadowfaxEnv();
    expect(getPlaceOrderUrl()).toBe(`${PROXY_BASE}/api/v2/orders/`);
  });

  it('getOrderStatusUrl substitutes {id} in SHADOWFAX_ORDER_STATUS_URL', () => {
    setShadowfaxEnv();
    expect(getOrderStatusUrl('21039906')).toBe(`${PROXY_BASE}/api/v2/orders/21039906/status/`);
  });

  it('getCancelOrderUrl uses SHADOWFAX_CANCEL_ORDER_URL when set', () => {
    setShadowfaxEnv();
    process.env.SHADOWFAX_CANCEL_ORDER_URL = `${PROXY_BASE}/api/v2/orders/{id}/cancel/`;
    expect(getCancelOrderUrl('21039906')).toBe(`${PROXY_BASE}/api/v2/orders/21039906/cancel/`);
  });

  it('getCancelOrderUrl derives from SHADOWFAX_ORDER_STATUS_URL when cancel URL is unset', () => {
    setShadowfaxEnv();
    delete process.env.SHADOWFAX_CANCEL_ORDER_URL;
    expect(getCancelOrderUrl('21039906')).toBe(`${PROXY_BASE}/api/v2/orders/21039906/cancel/`);
  });

  it('getDispatchReadyUrl uses SHADOWFAX_DISPATCH_READY_URL when set', () => {
    setShadowfaxEnv();
    process.env.SHADOWFAX_DISPATCH_READY_URL = `${PROXY_BASE}/api/v2/orders/{id}/dispatch-ready/`;
    expect(getDispatchReadyUrl('a124ce11-585c-4c6f-b679-03d8a0835e9a')).toBe(
      `${PROXY_BASE}/api/v2/orders/a124ce11-585c-4c6f-b679-03d8a0835e9a/dispatch-ready/`,
    );
  });

  it('getDispatchReadyUrl derives from SHADOWFAX_ORDER_STATUS_URL when dispatch-ready URL is unset', () => {
    setShadowfaxEnv();
    delete process.env.SHADOWFAX_DISPATCH_READY_URL;
    expect(getDispatchReadyUrl('a124ce11-585c-4c6f-b679-03d8a0835e9a')).toBe(
      `${PROXY_BASE}/api/v2/orders/a124ce11-585c-4c6f-b679-03d8a0835e9a/dispatch-ready/`,
    );
  });

  it('throws when SHADOWFAX_PLACE_ORDER_URL is missing', () => {
    setShadowfaxEnv();
    delete process.env.SHADOWFAX_PLACE_ORDER_URL;
    expect(() => getPlaceOrderUrl()).toThrow(/SHADOWFAX_PLACE_ORDER_URL/);
  });

  it('throws when SHADOWFAX_ORDER_STATUS_URL has no {id}', () => {
    setShadowfaxEnv();
    process.env.SHADOWFAX_ORDER_STATUS_URL = `${PROXY_BASE}/api/v2/orders/status/`;
    expect(() => getOrderStatusUrl('1')).toThrow(/\{id\}/);
  });
});
