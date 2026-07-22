import { describe, expect, it } from 'vitest';
import { normalizeTicketImageUrls } from './ticketImageUrls';

describe('normalizeTicketImageUrls', () => {
  it('returns null for empty values', () => {
    expect(normalizeTicketImageUrls(null)).toBeNull();
    expect(normalizeTicketImageUrls(undefined)).toBeNull();
    expect(normalizeTicketImageUrls('')).toBeNull();
    expect(normalizeTicketImageUrls([])).toBeNull();
  });

  it('keeps a clean URL array', () => {
    expect(
      normalizeTicketImageUrls([
        'https://example.com/a.jpg',
        'https://example.com/b.jpg',
      ]),
    ).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  it('unwraps a JSON-stringified array', () => {
    expect(
      normalizeTicketImageUrls(
        '["https://example.com/a.jpg","https://example.com/b.jpg"]',
      ),
    ).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  it('unwraps double-encoded array-in-array-string (API bug shape)', () => {
    expect(
      normalizeTicketImageUrls([
        '["https://example.com/a.jpg","https://example.com/b.jpg"]',
      ]),
    ).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  it('wraps a single URL string', () => {
    expect(normalizeTicketImageUrls('https://example.com/a.jpg')).toEqual([
      'https://example.com/a.jpg',
    ]);
  });
});
