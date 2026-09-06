import { describe, expect, it } from 'vitest';
import { kvList } from '@/lib/kv';
import { claimPasskeyChallenge } from '@/lib/passkey-challenge';

/**
 * The 2026-09-02 sweep recorded this as a follow-up: a passkey challenge lived
 * only in an httpOnly cookie, so a captured request could be replayed for five
 * minutes. These assert the barrier and, just as importantly, the DIRECTION it
 * fails in — see the module docstring.
 */

let counter = 0;
const uniqueChallenge = () => `challenge-${Date.now()}-${counter++}`;

describe('claimPasskeyChallenge', () => {
  it('allows the first presentation and refuses the second', async () => {
    const challenge = uniqueChallenge();
    expect(await claimPasskeyChallenge('signin', challenge)).toBe('fresh');
    expect(await claimPasskeyChallenge('signin', challenge)).toBe('replay');
    // Still refused on a third go: the marker is not consumed by reading it.
    expect(await claimPasskeyChallenge('signin', challenge)).toBe('replay');
  });

  it('keeps separate challenges independent', async () => {
    expect(await claimPasskeyChallenge('signin', uniqueChallenge())).toBe('fresh');
    expect(await claimPasskeyChallenge('signin', uniqueChallenge())).toBe('fresh');
  });

  it('scopes the marker to its ceremony', async () => {
    // Spending a sign-in challenge must not make a registration challenge that
    // happens to carry the same bytes look spent — the ceremonies are separate
    // and a collision here would present as a mystery "challenge expired".
    const challenge = uniqueChallenge();
    expect(await claimPasskeyChallenge('signin', challenge)).toBe('fresh');
    expect(await claimPasskeyChallenge('register', challenge)).toBe('fresh');
    expect(await claimPasskeyChallenge('admin-reauth', challenge)).toBe('fresh');
    expect(await claimPasskeyChallenge('admin-device', challenge)).toBe('fresh');
  });

  it('refuses an empty challenge rather than treating it as unseen', async () => {
    expect(await claimPasskeyChallenge('signin', '')).toBe('replay');
  });

  it('never stores the challenge itself', async () => {
    // An operator listing the namespace should not be able to read a live
    // ceremony value back out of it.
    const challenge = uniqueChallenge();
    await claimPasskeyChallenge('signin', challenge);
    const keys = await kvList('pkchal:');
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((key) => key.includes(challenge))).toBe(false);
    // Fixed-length SHA-256 hex, whatever the challenge's own length.
    expect(keys.every((key) => /^pkchal:[a-z-]+:[0-9a-f]{64}$/.test(key))).toBe(true);
  });
});
