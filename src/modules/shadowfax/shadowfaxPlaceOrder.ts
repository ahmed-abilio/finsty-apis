import type Order from '@modules/order/order.model';
import type OrderItem from '@modules/order/order-item.model';
import type Store from '@modules/store/store.model';
import type Address from '@modules/address/address.model';
import { getShadowfaxClientCode, getShadowfaxPickupContactFallback } from './shadowfax.config';
import type { ShadowfaxPlaceOrderRequest, ParsedPlaceOrderResponse } from './shadowfaxPlaceOrder.types';
import type { ShadowfaxReplaySnapshot } from './shadowfaxDelivery';
import { buildShadowfaxReplayFromSubtotal } from './shadowfaxDelivery';

const TRACK_URL_KEYS = ['track_url', 'trackUrl', 'tracking_url', 'trackingUrl'] as const;
const ORDER_ID_KEYS = [
  'order_id',
  'orderId',
  'id',
  'sfx_order_id',
  'shadowfax_order_id',
  'client_order_id',
] as const;
const DELIVERY_COST_KEYS = [
  'delivery_cost',
  'deliveryCost',
  'delivery_charge',
  'delivery_fee',
  'rider_cost',
] as const;

function unwrapPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const o = payload as Record<string, unknown>;
  if (o.success === true && 'data' in o) return o.data;
  return payload;
}

function formatAddressLine(line1: string, line2: string | null): string {
  return line2 ? `${line1}, ${line2}` : line1;
}

/** HL API expects 10-digit Indian mobile numbers (no +91 prefix). */
export function normalizeShadowfaxContactNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function sumOrderItemsMerchandiseValue(
  items: Array<{ unitPrice: number; quantity: number }>,
): number {
  const total = items.reduce((acc, item) => acc + Number(item.unitPrice) * item.quantity, 0);
  return parseFloat(total.toFixed(2));
}

/**
 * Declared order value for Shadowfax (merchandise total from line items).
 * Must align with sum of `order_items[].price * quantity`.
 */
export function resolveShadowfaxPlaceOrderValue(
  items: Array<{ unitPrice: number; quantity: number }>,
): number {
  return sumOrderItemsMerchandiseValue(items);
}

/** Shadowfax sample uses numeric product ids; derive digits from UUID or line index. */
export function shadowfaxOrderItemId(productId: string, lineIndex: number): string {
  const digits = productId.replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 12);
  return String(lineIndex + 1);
}

/** Immediate-ish slot: now + buffer, format `YYYY-MM-DD HH:mm:ss`. */
export function formatShadowfaxScheduledTime(bufferMinutes = 15): string {
  const d = new Date(Date.now() + bufferMinutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function randomFourDigitOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function getShadowfaxReplayFromOrder(order: Order): ShadowfaxReplaySnapshot {
  const meta = order.metadata as { shadowfaxReplay?: ShadowfaxReplaySnapshot } | null;
  if (meta?.shadowfaxReplay?.orderValue) {
    return meta.shadowfaxReplay;
  }
  return buildShadowfaxReplayFromSubtotal(Number(order.subtotal), 'true');
}

export function resolvePickupPhone(store: Store): string | null {
  const phone = store.phone?.trim();
  if (phone) return phone;
  return getShadowfaxPickupContactFallback();
}

export function buildPlaceOrderPayload(params: {
  order: Order;
  store: Store;
  address: Address;
  items: OrderItem[];
  replay?: ShadowfaxReplaySnapshot;
}): ShadowfaxPlaceOrderRequest {
  const { order, store, address, items } = params;
  const replay = params.replay ?? getShadowfaxReplayFromOrder(order);
  const pickupPhone = resolvePickupPhone(store);

  if (!pickupPhone) {
    throw new Error('PICKUP_PHONE_REQUIRED');
  }

  const isPrepaid = replay.paid === 'true';
  const orderValue = resolveShadowfaxPlaceOrderValue(items);
  const pickupAddress = formatAddressLine(
    store.address,
    store.addressLine2 ?? null,
  );

  return {
    client_code: getShadowfaxClientCode(),
    order_details: {
      client_order_id: order.id,
      order_value: orderValue,
      paid: isPrepaid,
      rain_flag: replay.rainFlag ?? false,
      scheduled_time: formatShadowfaxScheduledTime(),
      pickup_otp: randomFourDigitOtp(),
      return_otp: randomFourDigitOtp(),
    },
    pickup_details: {
      name: store.name,
      contact_number: normalizeShadowfaxContactNumber(pickupPhone),
      address: pickupAddress,
      latitude: Number(store.latitude),
      longitude: Number(store.longitude),
      city: store.city,
    },
    drop_details: {
      name: address.receiverName,
      contact_number: normalizeShadowfaxContactNumber(address.receiverPhone),
      address: formatAddressLine(address.line1, address.line2),
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
      city: address.city,
    },
    order_items: items.map((item, index) => ({
      id: shadowfaxOrderItemId(item.productId, index),
      name: item.productName,
      price: Number(item.unitPrice),
      quantity: item.quantity,
    })),
  };
}

export function parsePlaceOrderResponse(payload: unknown): ParsedPlaceOrderResponse {
  const inner = unwrapPayload(payload);
  if (!inner || typeof inner !== 'object') {
    return { shadowfaxOrderId: null, trackUrl: null, deliveryCost: null };
  }

  const stack: unknown[] = [inner];
  const seen = new Set<unknown>();
  let shadowfaxOrderId: string | null = null;
  let trackUrl: string | null = null;
  let deliveryCost: number | null = null;

  while (stack.length > 0 && seen.size < 80) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as Record<string, unknown>;

    if (!trackUrl) {
      for (const k of TRACK_URL_KEYS) {
        const v = o[k];
        if (typeof v === 'string' && v.length > 0) {
          trackUrl = v;
          break;
        }
      }
    }

    if (!shadowfaxOrderId) {
      for (const k of ORDER_ID_KEYS) {
        const v = o[k];
        if (v !== null && v !== undefined && String(v).length > 0) {
          shadowfaxOrderId = String(v);
          break;
        }
      }
    }

    if (deliveryCost === null) {
      for (const k of DELIVERY_COST_KEYS) {
        if (!(k in o)) continue;
        const raw = o[k];
        const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
        if (Number.isFinite(n)) {
          deliveryCost = parseFloat(n.toFixed(2));
          break;
        }
      }
    }

    for (const v of Object.values(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) stack.push(v);
    }
  }

  return { shadowfaxOrderId, trackUrl, deliveryCost };
}
