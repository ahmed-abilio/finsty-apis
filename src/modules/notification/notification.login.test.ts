import { describe, expect, it } from 'vitest';
import { resolveLoginGreeting, WELCOME_BACK_AFTER_DAYS } from './notification.login';

describe('resolveLoginGreeting', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');

  it('returns welcome for first-time users', () => {
    expect(resolveLoginGreeting({ isNew: true, lastLoginAt: null, now })).toBe('welcome');
  });

  it('returns welcome when lastLoginAt was never set', () => {
    expect(resolveLoginGreeting({ isNew: false, lastLoginAt: null, now })).toBe('welcome');
  });

  it('returns null when re-logging within 12 days', () => {
    const elevenDaysAgo = new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000);
    expect(
      resolveLoginGreeting({ isNew: false, lastLoginAt: elevenDaysAgo, now }),
    ).toBeNull();
  });

  it('returns welcome_back when previous login was 12+ days ago', () => {
    const twelveDaysAgo = new Date(now.getTime() - WELCOME_BACK_AFTER_DAYS * 24 * 60 * 60 * 1000);
    expect(
      resolveLoginGreeting({ isNew: false, lastLoginAt: twelveDaysAgo, now }),
    ).toBe('welcome_back');
  });

  it('returns welcome_back when previous login was more than 12 days ago', () => {
    const thirteenDaysAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
    expect(
      resolveLoginGreeting({ isNew: false, lastLoginAt: thirteenDaysAgo, now }),
    ).toBe('welcome_back');
  });
});
