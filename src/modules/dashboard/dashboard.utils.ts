import {
  formatUtcDateKey,
  parseRevenueDateRange,
  type DateRange,
} from '@modules/store/vendorDashboard.utils';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize a date string to start-of-day UTC when given YYYY-MM-DD. */
export function normalizeRangeStart(value: string): Date {
  if (DATE_ONLY_RE.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
  return new Date(value);
}

/** Normalize a date string to end-of-day UTC when given YYYY-MM-DD. */
export function normalizeRangeEnd(value: string): Date {
  if (DATE_ONLY_RE.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }
  return new Date(value);
}

/** Last 30 calendar days inclusive (start 00:00 UTC, end today 23:59:59 UTC). */
export function getDefaultDashboardRange(now = new Date()): DateRange {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0),
  );
  return { start, end };
}

export function resolveDashboardDateRange(from?: string, to?: string, now = new Date()): DateRange {
  if (!from && !to) {
    return getDefaultDashboardRange(now);
  }
  if (!from || !to) {
    throw new Error('INVALID_DATE_RANGE');
  }
  const start = normalizeRangeStart(from);
  const end = normalizeRangeEnd(to);
  return parseRevenueDateRange(start.toISOString(), end.toISOString());
}

export function enumerateUtcDateKeys(range: DateRange): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(
      range.start.getUTCFullYear(),
      range.start.getUTCMonth(),
      range.start.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const endDay = new Date(
    Date.UTC(
      range.end.getUTCFullYear(),
      range.end.getUTCMonth(),
      range.end.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  while (cursor.getTime() <= endDay.getTime()) {
    keys.push(formatUtcDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export { getPreviousPeriodRange, formatUtcDateKey, percentChange } from '@modules/store/vendorDashboard.utils';
export type { DateRange } from '@modules/store/vendorDashboard.utils';
