import { describe, expect, it } from 'vitest';
import { toSafeJsonLdString } from '@/lib/safe-json-ld';

describe('toSafeJsonLdString', () => {
  it('escapes "</script>" so untrusted text cannot break out of the tag', () => {
    const malicious = { name: '</script><script>alert(1)</script>' };
    const out = toSafeJsonLdString(malicious);

    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script>\\u003cscript>');
  });

  it('still produces valid, parseable JSON with the original value restored', () => {
    const data = { name: '</script>evil', nested: { ok: true } };
    const out = toSafeJsonLdString(data);

    expect(JSON.parse(out)).toEqual(data);
  });

  it('matches plain JSON.stringify when there is no "<" to escape', () => {
    const data = { a: 1, b: 'plain text' };
    expect(toSafeJsonLdString(data)).toBe(JSON.stringify(data));
  });
});
