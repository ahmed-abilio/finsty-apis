import type { ShadowfaxWebhookPayload } from './shadowfax-webhook.types';

function normalizeTimestamp(value: unknown): string {
  if (value == null || value === '') return new Date(0).toISOString();
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

function pickTimestamp(payload: ShadowfaxWebhookPayload): string {
  const status = (payload.order_status ?? payload.status ?? '').toUpperCase();

  if (status === 'DELIVERED' && payload.delivery_time) {
    return normalizeTimestamp(payload.delivery_time);
  }
  if ((status === 'CANCELLED' || status === 'CANCELLED_BY_CUSTOMER') && payload.cancel_time) {
    return normalizeTimestamp(payload.cancel_time);
  }
  if (status === 'RETURNED_TO_SELLER' && payload.rts_time) {
    return normalizeTimestamp(payload.rts_time);
  }
  if (payload.event_time) return normalizeTimestamp(payload.event_time);
  if (payload.updated_at) return normalizeTimestamp(payload.updated_at);
  if (payload.timestamp) return normalizeTimestamp(payload.timestamp);
  return new Date().toISOString();
}

export function buildShadowfaxEventKey(payload: ShadowfaxWebhookPayload): string {
  const clientOrderId = String(
    payload.client_order_id ?? payload.order_details?.client_order_id ?? 'unknown',
  );
  const orderStatus = String(payload.order_status ?? payload.status ?? 'UNKNOWN').toUpperCase();
  const ts = pickTimestamp(payload);
  return `${clientOrderId}_${orderStatus}_${ts}`;
}

export function extractShadowfaxStatus(payload: ShadowfaxWebhookPayload): string {
  return String(payload.order_status ?? payload.status ?? '').toUpperCase();
}

export function extractClientOrderId(payload: ShadowfaxWebhookPayload): string | null {
  const id = payload.client_order_id ?? payload.order_details?.client_order_id;
  return id != null ? String(id) : null;
}

export function extractSfxOrderId(payload: ShadowfaxWebhookPayload): number | null {
  const raw = payload.sfx_order_id ?? payload.order_id ?? payload.sfxOrderId;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
