import { AppError } from '@utils/appError';

export interface ShadowfaxConfig {
  apiKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw AppError.internal(`Shadowfax is not configured. Set ${name}.`, 'SHADOWFAX_NOT_CONFIGURED');
  }
  return value;
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function getShadowfaxConfig(): ShadowfaxConfig {
  return {
    apiKey: requireEnv('SHADOWFAX_API_KEY'),
  };
}

/** PUT/POST target for Shadowfax order serviceability (v1). */
export function getOrderServiceabilityUrl(): string {
  return normalizeUrl(requireEnv('SHADOWFAX_SERVICEABILITY_URL'));
}

/** POST target for Shadowfax HL marketplace place-order (v2). */
export function getPlaceOrderUrl(): string {
  return normalizeUrl(requireEnv('SHADOWFAX_PLACE_ORDER_URL'));
}

/** GET target for Shadowfax HL marketplace order status (v2). Template must include `{id}`. */
export function getOrderStatusUrl(shadowfaxOrderId: string): string {
  return buildShadowfaxOrderIdUrl(
    'SHADOWFAX_ORDER_STATUS_URL',
    shadowfaxOrderId,
    'SHADOWFAX_ORDER_STATUS_URL must include {id} for the Shadowfax order id.',
  );
}

/** PUT target for Shadowfax HL marketplace order cancel (v2). Template must include `{id}`. */
export function getCancelOrderUrl(shadowfaxOrderId: string): string {
  const explicit = process.env.SHADOWFAX_CANCEL_ORDER_URL?.trim();
  if (explicit) {
    return buildShadowfaxOrderIdUrl(
      'SHADOWFAX_CANCEL_ORDER_URL',
      shadowfaxOrderId,
      'SHADOWFAX_CANCEL_ORDER_URL must include {id} for the Shadowfax order id.',
      explicit,
    );
  }

  const statusTemplate = process.env.SHADOWFAX_ORDER_STATUS_URL?.trim();
  if (statusTemplate?.includes('{id}') && /\/status\/?$/i.test(statusTemplate)) {
    const cancelTemplate = statusTemplate.replace(/\/status\/?$/i, '/cancel/');
    return buildShadowfaxOrderIdUrl(
      'SHADOWFAX_ORDER_STATUS_URL',
      shadowfaxOrderId,
      'SHADOWFAX_ORDER_STATUS_URL must include {id} for the Shadowfax order id.',
      cancelTemplate,
    );
  }

  throw AppError.internal(
    'Shadowfax cancel URL is not configured. Set SHADOWFAX_CANCEL_ORDER_URL or SHADOWFAX_ORDER_STATUS_URL with {id}.',
    'SHADOWFAX_CONFIG_INVALID',
  );
}

/** PUT target for Shadowfax HL marketplace dispatch-ready (v2). Template must include `{id}` (client_order_id). */
export function getDispatchReadyUrl(clientOrderId: string): string {
  const explicit = process.env.SHADOWFAX_DISPATCH_READY_URL?.trim();
  if (explicit) {
    return buildShadowfaxOrderIdUrl(
      'SHADOWFAX_DISPATCH_READY_URL',
      clientOrderId,
      'SHADOWFAX_DISPATCH_READY_URL must include {id} for the Shadowfax client order id.',
      explicit,
    );
  }

  const statusTemplate = process.env.SHADOWFAX_ORDER_STATUS_URL?.trim();
  if (statusTemplate?.includes('{id}') && /\/status\/?$/i.test(statusTemplate)) {
    const dispatchReadyTemplate = statusTemplate.replace(/\/status\/?$/i, '/dispatch-ready/');
    return buildShadowfaxOrderIdUrl(
      'SHADOWFAX_ORDER_STATUS_URL',
      clientOrderId,
      'SHADOWFAX_ORDER_STATUS_URL must include {id} for the Shadowfax client order id.',
      dispatchReadyTemplate,
    );
  }

  throw AppError.internal(
    'Shadowfax dispatch-ready URL is not configured. Set SHADOWFAX_DISPATCH_READY_URL or SHADOWFAX_ORDER_STATUS_URL with {id}.',
    'SHADOWFAX_CONFIG_INVALID',
  );
}

function buildShadowfaxOrderIdUrl(
  envName: string,
  shadowfaxOrderId: string,
  missingIdMessage: string,
  templateOverride?: string,
): string {
  const template = templateOverride ?? requireEnv(envName);
  if (!template.includes('{id}')) {
    throw AppError.internal(missingIdMessage, 'SHADOWFAX_CONFIG_INVALID');
  }
  const id = encodeURIComponent(shadowfaxOrderId);
  return template.replace(/\{id\}/g, id);
}

export function tryGetShadowfaxClientCode(): string | null {
  const code = process.env.SHADOWFAX_CLIENT_CODE?.trim();
  return code || null;
}

export function getShadowfaxClientCode(): string {
  const code = tryGetShadowfaxClientCode();
  if (!code) {
    throw AppError.internal(
      'Shadowfax client code is not configured. Set SHADOWFAX_CLIENT_CODE.',
      'SHADOWFAX_CLIENT_CODE_MISSING',
    );
  }
  return code;
}

export function getShadowfaxPickupContactFallback(): string | null {
  const phone = process.env.SHADOWFAX_PICKUP_CONTACT?.trim();
  return phone || null;
}

const DEFAULT_SHADOWFAX_REQUEST_TIMEOUT_MS = 30_000;

export function getShadowfaxRequestTimeoutMs(): number {
  const raw = process.env.SHADOWFAX_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_SHADOWFAX_REQUEST_TIMEOUT_MS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SHADOWFAX_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}
