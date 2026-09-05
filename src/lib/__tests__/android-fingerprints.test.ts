import { describe, expect, it } from 'vitest';

import { normalizeFingerprint, parseAndroidFingerprints } from '@/lib/android-fingerprints';

/* Real shapes, so the test proves the thing an operator will actually paste
   rather than a convenient fiction. Both come from the same Play Console row —
   which is the whole problem. */
const SHA256 =
  'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90';
const SHA1 = 'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4';

describe('normalizeFingerprint', () => {
  it('accepts the colon-separated form Play Console shows', () => {
    expect(normalizeFingerprint(SHA256)).toBe(SHA256);
  });

  it('accepts the same digest unseparated, and normalises it to colons', () => {
    /* Some tooling emits 64 bare hex characters. Google's documentation and
       every example use the colon form, so that is what gets served. */
    expect(normalizeFingerprint(SHA256.replace(/:/g, ''))).toBe(SHA256);
  });

  it('accepts lowercase and uppercases it', () => {
    expect(normalizeFingerprint(SHA256.toLowerCase())).toBe(SHA256);
  });

  /* THE ONE THAT MATTERS. The SHA-1 sits directly above the SHA-256 on the
     same Play Console screen, both are colon-separated uppercase hex, and only
     the length tells them apart. Accepting it produces a served, well-formed
     association file that Google caches as a permanent verification FAILURE —
     strictly worse than serving no file at all. */
  it('rejects the SHA-1 from the same screen', () => {
    expect(normalizeFingerprint(SHA1)).toBeNull();
  });

  it('rejects truncated, over-long and non-hex values', () => {
    expect(normalizeFingerprint(SHA256.slice(0, -3))).toBeNull();
    expect(normalizeFingerprint(`${SHA256}:AB`)).toBeNull();
    expect(normalizeFingerprint(SHA256.replace('A1', 'ZZ'))).toBeNull();
    expect(normalizeFingerprint('')).toBeNull();
    expect(normalizeFingerprint('not a fingerprint')).toBeNull();
  });
});

describe('parseAndroidFingerprints', () => {
  it('is empty for an unset secret, which is what makes the route 404', () => {
    for (const empty of [undefined, null, '', '   ', ',,']) {
      expect(parseAndroidFingerprints(empty).valid).toEqual([]);
    }
  });

  it('keeps the two fingerprints an operator is told to set', () => {
    const other = SHA1.replace(/:/g, '') + 'AABBCCDDEEFF00112233445566778899'.slice(0, 24);
    const second = normalizeFingerprint(other);
    expect(second).not.toBeNull();
    const parsed = parseAndroidFingerprints(`${SHA256}, ${other}`);
    expect(parsed.valid).toEqual([SHA256, second]);
    expect(parsed.rejected).toEqual([]);
  });

  it('de-duplicates', () => {
    expect(parseAndroidFingerprints(`${SHA256},${SHA256.toLowerCase()}`).valid).toEqual([SHA256]);
  });

  /* Reported, not silently dropped. One good and one malformed entry would
     otherwise serve a file that verifies store installs and fails the
     operator's own test installs — which reads as flakiness rather than as a
     typo, and is the most expensive way to learn about it. */
  it('reports what it refused alongside what it kept', () => {
    const parsed = parseAndroidFingerprints(`${SHA256},${SHA1}`);
    expect(parsed.valid).toEqual([SHA256]);
    expect(parsed.rejected).toEqual([SHA1]);
  });

  it('leaves nothing valid when every entry is bad, so the file stays absent', () => {
    const parsed = parseAndroidFingerprints(`${SHA1},nonsense`);
    expect(parsed.valid).toEqual([]);
    expect(parsed.rejected).toEqual([SHA1, 'nonsense']);
  });
});
