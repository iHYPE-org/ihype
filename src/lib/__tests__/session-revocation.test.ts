import { describe, expect, it } from 'vitest';
import { isSessionRevoked, revokeSessionJti } from '@/lib/session-revocation';

/**
 * Signing out has to end the session on the SERVER. The cookie going away only
 * ever ended it in the browser that pressed the button, and the token is a
 * self-contained JWT good for twelve hours (2026-09-02 sweep follow-up).
 */

let counter = 0;
const jti = () => `jti-${Date.now()}-${counter++}`;
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

describe('session revocation', () => {
  it('marks one token dead and leaves every other token alone', async () => {
    const revoked = jti();
    const other = jti();

    expect(await isSessionRevoked(revoked)).toBe(false);
    await revokeSessionJti(revoked, inAnHour());

    expect(await isSessionRevoked(revoked)).toBe(true);
    // The point of doing this per token rather than by bumping
    // userSecurityVersion: signing out here must not sign out the phone.
    expect(await isSessionRevoked(other)).toBe(false);
  });

  it('treats a missing or malformed jti as not revoked', async () => {
    expect(await isSessionRevoked(undefined)).toBe(false);
    expect(await isSessionRevoked(null)).toBe(false);
    expect(await isSessionRevoked('')).toBe(false);
    expect(await isSessionRevoked(42)).toBe(false);
    expect(await isSessionRevoked({ jti: 'nope' })).toBe(false);
  });

  it('does nothing for a token that has already expired', async () => {
    // Nothing can present it, so a tombstone would only take up room until it
    // aged out on its own.
    const stale = jti();
    await revokeSessionJti(stale, Math.floor(Date.now() / 1000) - 60);
    expect(await isSessionRevoked(stale)).toBe(false);
  });

  it('revokes a token whose expiry is unknown', async () => {
    // An undecodable expiry must not mean "leave it working" — the tombstone
    // falls back to a full session length instead.
    const unknown = jti();
    await revokeSessionJti(unknown, null);
    expect(await isSessionRevoked(unknown)).toBe(true);
  });

  it('ignores an absent jti rather than writing a blank tombstone', async () => {
    // A blank key would match every token that also has no jti.
    await revokeSessionJti(null, inAnHour());
    await revokeSessionJti('', inAnHour());
    expect(await isSessionRevoked('')).toBe(false);
  });
});
