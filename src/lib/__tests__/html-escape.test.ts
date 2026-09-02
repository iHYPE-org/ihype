import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../html-escape';

describe('escapeHtml', () => {
  it('neutralises markup in text and attribute positions', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml(`Tom's "Band" & Co`)).toBe('Tom&#39;s &quot;Band&quot; &amp; Co');
  });

  it('leaves plain text alone and tolerates empty values', () => {
    expect(escapeHtml('The Velvet Room')).toBe('The Velvet Room');
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
