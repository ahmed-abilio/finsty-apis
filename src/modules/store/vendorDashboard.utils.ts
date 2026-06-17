/** Order statuses that count toward vendor revenue and order metrics. */
export const VENDOR_SALES_ORDER_STATUSES = [
  'confirmed',
  'rider_assigned',
  'at_store',
  'picked_up',
  'out_for_delivery',
  'delivered',
] as const;

export interface DateRange {
  start: Date;
  end: Date;
}

export function percentChange(current: number, previous: number): number {
  const cur = parseFloat(Number(current).toFixed(2));
  const prev = parseFloat(Number(previous).toFixed(2));
  if (prev === 0) {
    return cur > 0 ? 100 : 0;
  }
  return parseFloat((((cur - prev) / prev) * 100).toFixed(2));
}

/** Start of calendar month in UTC. */
export function startOfUtcMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

/** End of calendar month in UTC (last ms of month). */
export function endOfUtcMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

export function getCurrentMonthRange(now = new Date()): DateRange {
  return {
    start: startOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth()),
    end: now,
  };
}

export function getPreviousMonthRange(now = new Date()): DateRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const prevMonth = m === 0 ? 11 : m - 1;
  const prevYear = m === 0 ? y - 1 : y;
  return {
    start: startOfUtcMonth(prevYear, prevMonth),
    end: endOfUtcMonth(prevYear, prevMonth),
  };
}

/** Full calendar month before the previous month (for revenue.lastMonth comparison). */
export function getMonthBeforePreviousRange(now = new Date()): DateRange {
  const prev = getPreviousMonthRange(now);
  const y = prev.start.getUTCFullYear();
  const m = prev.start.getUTCMonth();
  const beforeMonth = m === 0 ? 11 : m - 1;
  const beforeYear = m === 0 ? y - 1 : y;
  return {
    start: startOfUtcMonth(beforeYear, beforeMonth),
    end: endOfUtcMonth(beforeYear, beforeMonth),
  };
}

/** Last 7 calendar days in UTC (today − 6 through today), inclusive. */
export function getLast7DayRanges(now = new Date()): DateRange[] {
  const ranges: DateRange[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i, 0, 0, 0, 0),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i, 23, 59, 59, 999),
    );
    ranges.push({ start: d, end });
  }
  return ranges;
}

export function formatUtcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Previous period of equal duration ending immediately before `current.start`. */
export function getPreviousPeriodRange(current: DateRange): DateRange {
  const durationMs = current.end.getTime() - current.start.getTime();
  const previousEnd = new Date(current.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { start: previousStart, end: previousEnd };
}

export function parseRevenueDateRange(from: string, to: string): DateRange {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('INVALID_DATE');
  }
  if (end.getTime() < start.getTime()) {
    throw new Error('INVALID_RANGE');
  }
  return { start, end };
}
