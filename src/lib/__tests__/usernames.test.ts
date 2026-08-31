import { describe, expect, it } from 'vitest';
import { deriveUsernameCandidate, isValidUsername } from '@/lib/usernames';

/**
 * Signup never shows a username field, so anything derived from the display
 * name has to come out legal on its own. Every case below was a real 400 or
 * 409 at signup before 2026-08-31, reported against a field the member had
 * never seen.
 */
describe('deriveUsernameCandidate', () => {
  it('produces a handle that isValidUsername accepts, for ordinary names', () => {
    for (const name of ['Sarah Smith', 'The Midnight Cassettes', 'DJ_Nine', 'a.b-c']) {
      const derived = deriveUsernameCandidate(name);
      expect(derived, name).not.toBeNull();
      expect(isValidUsername(derived!), `${name} -> ${derived}`).toBe(true);
    }
  });

  it('drops characters the pattern forbids instead of refusing the signup', () => {
    // An apostrophe in a surname is common enough that refusing it is a bug.
    expect(deriveUsernameCandidate("Sarah O'Brien")).toBe('sarahobrien');
    expect(deriveUsernameCandidate('Renée Fleming')).toBe('reneefleming');
    expect(deriveUsernameCandidate('Ana María Núñez')).toBe('anamarianunez');
  });

  it('returns null rather than an illegal handle when nothing survives', () => {
    // A non-Latin name normalises away entirely; the caller mints a random
    // handle. Before this, the empty string reached isValidUsername and the
    // member was told their username was invalid.
    expect(deriveUsernameCandidate('李明')).toBeNull();
    expect(deriveUsernameCandidate('Пётр')).toBeNull();
    expect(deriveUsernameCandidate('!!!')).toBeNull();
    expect(deriveUsernameCandidate('')).toBeNull();
  });

  it('returns null for a name below the pattern floor', () => {
    // usernamePattern allows 1 char, or 3-30 — never 2.
    expect(deriveUsernameCandidate('Bo')).toBeNull();
  });

  it('returns null for a reserved handle', () => {
    expect(deriveUsernameCandidate('Support')).toBeNull();
    expect(deriveUsernameCandidate('admin')).toBeNull();
  });

  it('never ends on a separator, including after the 30-char cut', () => {
    // 29 a's + ".tail" cuts at 30 to "aaa….", leaving a trailing dot the
    // pattern rejects; it has to be stripped AFTER the cut, not before.
    const long = deriveUsernameCandidate(`${'a'.repeat(29)}.tail`);
    expect(long).toBe('a'.repeat(29));
    expect(isValidUsername(long!)).toBe(true);

    expect(deriveUsernameCandidate('...dots...')).toBe('dots');
  });
});
