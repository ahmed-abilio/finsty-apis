import { describe, it, expect } from 'vitest';
import {
  enumerateUtcDateKeys,
  getDefaultDashboardRange,
  normalizeRangeEnd,
  normalizeRangeStart,
  resolveDashboardDateRange,
} from './dashboard.utils';

describe('getDefaultDashboardRange', () => {
  it('returns 30 inclusive calendar days ending today UTC', () => {
    const now = new Date('2026-06-24T15:30:00.000Z');
    const range = getDefaultDashboardRange(now);
    expect(range.end.toISOString()).toBe('2026-06-24T23:59:59.999Z');
    expect(range.start.toISOString()).toBe('2026-05-26T00:00:00.000Z');
  });
});

describe('normalizeRangeStart/End', () => {
  it('expands YYYY-MM-DD to UTC day boundaries', () => {
    expect(normalizeRangeStart('2026-06-01').toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(normalizeRangeEnd('2026-06-01').toISOString()).toBe('2026-06-01T23:59:59.999Z');
  });
});

describe('resolveDashboardDateRange', () => {
  it('defaults to last 30 days when params omitted', () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    const range = resolveDashboardDateRange(undefined, undefined, now);
    expect(range.start.toISOString()).toBe('2026-05-26T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-06-24T23:59:59.999Z');
  });

  it('parses date-only from/to', () => {
    const range = resolveDashboardDateRange('2026-06-01', '2026-06-07');
    expect(range.start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-06-07T23:59:59.999Z');
  });

  it('requires both from and to when either is provided', () => {
    expect(() => resolveDashboardDateRange('2026-06-01', undefined)).toThrow('INVALID_DATE_RANGE');
  });
});

describe('enumerateUtcDateKeys', () => {
  it('lists each UTC day in range inclusive', () => {
    const keys = enumerateUtcDateKeys({
      start: new Date('2026-06-01T00:00:00.000Z'),
      end: new Date('2026-06-03T23:59:59.999Z'),
    });
    expect(keys).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });
});
