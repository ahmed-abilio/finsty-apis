import { describe, expect, it } from 'vitest';
import { sanitizeCmsHtml } from './cms.sanitize';

describe('sanitizeCmsHtml', () => {
  it('preserves inline styles on divs and paragraphs', () => {
    const input =
      '<div style="background:#f5f5f5;border-radius:12px;padding:16px;margin-bottom:8px">' +
      '<p style="color:#333;font-size:14px;font-weight:600;line-height:1.5">Support card</p></div>';

    const out = sanitizeCmsHtml(input);

    expect(out).toContain('background:#f5f5f5');
    expect(out).toContain('border-radius:12px');
    expect(out).toContain('color:#333');
    expect(out).toContain('font-size:14px');
  });

  it('preserves class, href, target, and rel on links', () => {
    const input =
      '<a class="help-link" style="color:#0066cc;text-decoration:underline" href="https://example.com/help" target="_blank" rel="noopener">Help</a>';

    const out = sanitizeCmsHtml(input);

    expect(out).toContain('class="help-link"');
    expect(out).toContain('href="https://example.com/help"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('color:#0066cc');
  });

  it('strips script tags and dangerous style values', () => {
    const input =
      '<div style="width:expression(alert(1))">x</div><script>alert(1)</script><p onclick="evil()">y</p>';

    const out = sanitizeCmsHtml(input);

    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('expression');
  });
});
