/**
 * Normalizes ticket attachment URLs to a clean `string[] | null`.
 * Handles double-encoded JSON (e.g. `["[\\"https://...\\"]"]` or a JSON string stored in jsonb).
 */
export function normalizeTicketImageUrls(value: unknown): string[] | null {
  if (value == null || value === '') return null;

  let current: unknown = value;
  // Unwrap nested JSON strings (Sequelize/Postgres double-encoding).
  for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
    const trimmed = current.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[') || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }

  if (!Array.isArray(current)) return null;

  const urls: string[] = [];
  for (const item of current) {
    if (typeof item !== 'string') continue;
    const nested = normalizeTicketImageUrls(item);
    if (nested?.length) urls.push(...nested);
  }

  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  return unique.length ? unique : null;
}
