import { describe, expect, it } from 'vitest';
import {
  PASSKEY_BOOTSTRAP_MAX_AGE_SECONDS,
  createPasskeyBootstrapCapability,
  hashPasskeyBootstrapToken,
} from '@/lib/passkey-bootstrap';

describe('passkey bootstrap capabilities', () => {
  it('creates a high-entropy bearer token and stores only its hash', () => {
    const now = new Date('2026-07-09T00:00:00.000Z');
    const capability = createPasskeyBootstrapCapability(now);

    expect(capability.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(capability.tokenHash).toBe(hashPasskeyBootstrapToken(capability.token));
    expect(capability.tokenHash).not.toContain(capability.token);
    expect(capability.expiresAt.getTime() - now.getTime()).toBe(
      PASSKEY_BOOTSTRAP_MAX_AGE_SECONDS * 1000,
    );
  });

  it('does not produce the same capability twice', () => {
    const left = createPasskeyBootstrapCapability();
    const right = createPasskeyBootstrapCapability();
    expect(left.token).not.toBe(right.token);
    expect(left.tokenHash).not.toBe(right.tokenHash);
  });
});
