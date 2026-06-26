function pickString(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

const LOWERCASE_LABEL_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
]);

/** Human-readable cancellation type from any Shadowfax status code (e.g. CANCELLED_BY_CUSTOMER). */
export function mapShadowfaxCancelStatusToLabel(shadowfaxStatus: unknown): string | null {
  const raw = pickString(shadowfaxStatus)?.trim();
  if (!raw) return null;

  const words = raw.split('_').filter(Boolean);
  if (words.length === 0) return null;

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_LABEL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function extractShadowfaxCancelFields(source: {
  cancel_reason?: unknown;
  cancel_reason_text?: unknown;
  reason?: unknown;
  reason_text?: unknown;
  order_details?: object | null;
  status?: unknown;
  order_status?: unknown;
}): {
  cancelReasonCode: string | null;
  cancelReasonText: string | null;
  shadowfaxCancelStatus: string | null;
} {
  const details =
    source.order_details && typeof source.order_details === 'object'
      ? (source.order_details as Record<string, unknown>)
      : undefined;
  const cancelReasonCode =
    pickString(source.reason) ??
    pickString(details?.reason) ??
    pickString(source.cancel_reason) ??
    pickString(details?.cancel_reason);
  const cancelReasonText =
    pickString(source.reason_text) ??
    pickString(details?.reason_text) ??
    pickString(source.cancel_reason_text) ??
    pickString(details?.cancel_reason_text);
  const shadowfaxCancelStatus =
    pickString(source.status)?.toUpperCase() ??
    pickString(source.order_status)?.toUpperCase() ??
    null;

  return { cancelReasonCode, cancelReasonText, shadowfaxCancelStatus };
}
