import { mapShadowfaxCancelStatusToLabel } from '@modules/shadowfax/tracking/shadowfax-cancel-fields';

export interface OrderRiderDetails {
  id: number | null;
  name: string | null;
  phone: string | null;
  location: {
    latitude: string | null;
    longitude: string | null;
  } | null;
}

export interface OrderCancellationDetails {
  cancelledAt: string | null;
  reason: string | null;
  reasonText: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function extractRiderDetailsFromOrder(order: {
  riderId: number | null;
  riderName: string | null;
  riderPhone: string | null;
  deliveryMetadata: object | null;
}): OrderRiderDetails | null {
  const meta = asRecord(order.deliveryMetadata);
  const loc = asRecord(meta?.rider_location);
  const hasRider =
    order.riderId != null || Boolean(order.riderName) || Boolean(order.riderPhone) || loc != null;

  if (!hasRider) return null;

  return {
    id: order.riderId != null ? Number(order.riderId) : null,
    name: order.riderName ?? null,
    phone: order.riderPhone ?? null,
    location: loc
      ? {
          latitude: loc.latitude != null ? String(loc.latitude) : null,
          longitude: loc.longitude != null ? String(loc.longitude) : null,
        }
      : null,
  };
}

export function extractCancellationFromOrder(order: {
  status: string;
  cancelledAt: Date | null;
  deliveryMetadata: object | null;
}): OrderCancellationDetails | null {
  const meta = asRecord(order.deliveryMetadata);
  const reason =
    mapShadowfaxCancelStatusToLabel(meta?.shadowfax_cancel_status) ??
    (meta?.cancel_reason != null && !/^\d+$/.test(String(meta.cancel_reason))
      ? String(meta.cancel_reason)
      : null);
  const reasonText =
    meta?.cancel_reason_text != null ? String(meta.cancel_reason_text) : null;
  const cancelledAt = order.cancelledAt?.toISOString?.() ?? null;

  if (order.status !== 'cancelled' && !cancelledAt && !reason && !reasonText) {
    return null;
  }

  return { cancelledAt, reason, reasonText };
}
