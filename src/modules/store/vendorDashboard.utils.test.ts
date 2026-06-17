import { describe, it, expect } from 'vitest';
import {
  percentChange,
  getCurrentMonthRange,
  getPreviousMonthRange,
  getLast7DayRanges,
  formatUtcDateKey,
  getPreviousPeriodRange,
  parseRevenueDateRange,
} from './vendorDashboard.utils';

describe('percentChange', () => {
  it('returns positive when current is higher', () => {
    expect(percentChange(125, 100)).toBe(25);
  });

  it('returns negative when current is lower', () => {
    expect(percentChange(90, 100)).toBe(-10);
  });

  it('returns 100 when previous is 0 and current > 0', () => {
    expect(percentChange(50, 0)).toBe(100);
  });

  it('returns 0 when both are 0', () => {
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe('date ranges', () => {
  it('getLast7DayRanges returns 7 entries', () => {
    const now = new Date('2026-05-19T12:00:00.000Z');
    expect(getLast7DayRanges(now)).toHaveLength(7);
  });

  it('formatUtcDateKey formats YYYY-MM-DD', () => {
    expect(formatUtcDateKey(new Date('2026-05-13T00:00:00.000Z'))).toBe('2026-05-13');
  });

  it('previous month range ends before current month start', () => {
    const now = new Date('2026-05-19T12:00:00.000Z');
    const current = getCurrentMonthRange(now);
    const previous = getPreviousMonthRange(now);
    expect(previous.end.getTime()).toBeLessThan(current.start.getTime());
  });

  it('getPreviousPeriodRange returns equal-length window before current', () => {
    const current = {
      start: new Date('2026-05-10T00:00:00.000Z'),
      end: new Date('2026-05-20T23:59:59.999Z'),
    };
    const previous = getPreviousPeriodRange(current);
    const currentDuration = current.end.getTime() - current.start.getTime();
    const previousDuration = previous.end.getTime() - previous.start.getTime();
    expect(previousDuration).toBe(currentDuration);
    expect(previous.end.getTime()).toBeLessThan(current.start.getTime());
  });

  it('parseRevenueDateRange parses valid ISO timestamps', () => {
    const range = parseRevenueDateRange('2026-05-01T00:00:00.000Z', '2026-05-31T23:59:59.999Z');
    expect(range.start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-05-31T23:59:59.999Z');
  });

  it('parseRevenueDateRange rejects invalid timestamps', () => {
    expect(() => parseRevenueDateRange('not-a-date', '2026-05-01T00:00:00.000Z')).toThrow('INVALID_DATE');
  });

  it('parseRevenueDateRange rejects when to is before from', () => {
    expect(() =>
      parseRevenueDateRange('2026-05-31T00:00:00.000Z', '2026-05-01T00:00:00.000Z'),
    ).toThrow('INVALID_RANGE');
  });
});
