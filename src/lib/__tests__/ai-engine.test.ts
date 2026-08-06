import { describe, expect, it } from 'vitest';
import { parseAiJson } from '@/lib/ai';

describe('parseAiJson', () => {
  it('parses a bare JSON object', () => {
    expect(parseAiJson<{ ok: boolean }>('{"ok": true}')).toEqual({ ok: true });
  });

  it('extracts JSON wrapped in prose and markdown fences', () => {
    const raw = 'Sure! Here is the result:\n```json\n{"cleared": false, "reasoning": "rip"}\n```';
    expect(parseAiJson<{ cleared: boolean }>(raw)).toEqual({ cleared: false, reasoning: 'rip' });
  });

  it('returns null for empty, missing, or malformed responses', () => {
    expect(parseAiJson(null)).toBeNull();
    expect(parseAiJson('')).toBeNull();
    expect(parseAiJson('no json here')).toBeNull();
    expect(parseAiJson('{broken')).toBeNull();
  });
});
