/**
 * Shadowfax order serviceability → delivery fee extraction.
 *
 * Upstream JSON varies by tenant. The parser unwraps `{ success, data }` when present, then
 * walks nested objects for:
 * - Serviceability: `is_serviceable`, `serviceable`, `isServiceable`, or `non_serviceable` / `nonServiceable`.
 * - Fee (first match): `rider_cost`, `delivery_charge`, `delivery_fee`, `logistics_fee`,
 *   `estimated_delivery_cost`, `delivery_cost`, `total_delivery_charge`, `logistics_charge`, `shipping_charge`.
 * If your tenant uses different keys, extend `FEE_KEYS` or add a mapping once you have a sample payload.
 */
import shadowfaxClient, { type OrderServiceabilityRequest } from './shadowfax.client';

/** Persisted on the order so payment can replay the same Shadowfax request. */
export interface ShadowfaxReplaySnapshot {
  orderValue: string;
  paid: 'true' | 'false';
  rainFlag?: boolean;
  clientSurge?: number;
}

const FEE_KEYS = [
  'rider_cost',
  'delivery_charge',
  'delivery_fee',
  'logistics_fee',
  'estimated_delivery_cost',
  'delivery_cost',
  'total_delivery_charge',
  'logistics_charge',
  'shipping_charge',
] as const;

function unwrapPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const o = payload as Record<string, unknown>;
  if (o.success === true && 'data' in o) return o.data;
  return payload;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const v = obj[key];
  return typeof v === 'boolean' ? v : undefined;
}

/**
 * Parses Shadowfax order serviceability JSON (shape varies by tenant).
 * Tries common boolean flags and numeric fee fields on the root and nested objects.
 */
export function parseShadowfaxServiceabilityPayload(payload: unknown): {
  serviceable: boolean;
  deliveryFee: number;
} {
  const inner = unwrapPayload(payload);
  if (!inner || typeof inner !== 'object') {
    return { serviceable: false, deliveryFee: 0 };
  }

  const stack: unknown[] = [inner];
  const seen = new Set<unknown>();
  let serviceable: boolean | undefined;
  let nonServiceable: boolean | undefined;
  let deliveryFee: number | undefined;

  while (stack.length > 0 && seen.size < 80) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as Record<string, unknown>;

    const isSvc = readBoolean(o, 'is_serviceable');
    if (isSvc !== undefined) serviceable = isSvc;
    const svc = readBoolean(o, 'serviceable') ?? readBoolean(o, 'isServiceable');
    if (svc !== undefined) serviceable = svc;
    const ns = readBoolean(o, 'non_serviceable') ?? readBoolean(o, 'nonServiceable');
    if (ns !== undefined) nonServiceable = ns;

    if (deliveryFee === undefined) {
      for (const k of FEE_KEYS) {
        if (!(k in o)) continue;
        const raw = o[k];
        if (raw === null || raw === undefined) continue;
        const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
        if (Number.isFinite(n)) {
          deliveryFee = n;
          break;
        }
      }
    }

    for (const v of Object.values(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) stack.push(v);
    }
  }

  let resolvedServiceable = serviceable;
  if (nonServiceable === true) resolvedServiceable = false;
  if (resolvedServiceable === undefined) {
    if (deliveryFee !== undefined && deliveryFee >= 0) resolvedServiceable = true;
    else resolvedServiceable = false;
  }

  return {
    serviceable: resolvedServiceable,
    deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee.toFixed(2)) : 0,
  };
}

export function buildShadowfaxReplayFromSubtotal(
  subtotal: number,
  paid: 'true' | 'false' = 'true',
): ShadowfaxReplaySnapshot {
  return {
    orderValue: subtotal.toFixed(2),
    paid,
  };
}

export async function fetchShadowfaxDeliveryQuote(params: {
  pickupLatitude: number;
  pickupLongitude: number;
  dropLatitude: number;
  dropLongitude: number;
  replay: ShadowfaxReplaySnapshot;
  coid?: string;
}): Promise<{ serviceable: boolean; deliveryFee: number }> {
  const body: OrderServiceabilityRequest = {
    pickup_latitude: String(params.pickupLatitude),
    pickup_longitude: String(params.pickupLongitude),
    drop_latitude: String(params.dropLatitude),
    drop_longitude: String(params.dropLongitude),
    paid: params.replay.paid,
    order_value: params.replay.orderValue,
    ...(params.coid ? { COID: params.coid } : {}),
    ...(params.replay.rainFlag !== undefined ? { rain_flag: params.replay.rainFlag } : {}),
    ...(params.replay.clientSurge !== undefined ? { client_surge: params.replay.clientSurge } : {}),
  };

  const raw = await shadowfaxClient.checkOrderServiceability(body);
  return parseShadowfaxServiceabilityPayload(raw);
}
