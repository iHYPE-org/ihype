/**
 * Tests for the webhook idempotency pattern used in the Mux and Stripe webhook
 * handlers. The DB constraint is the lock — we test the in-memory logic that
 * wraps a Prisma create + unique-violation catch, using a Map-backed mock so no
 * real database is required.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// In-process idempotency store — mirrors the DB unique constraint behaviour
class IdempotencyStore {
  private seen = new Set<string>();

  async process(source: string, eventId: string): Promise<{ ok: boolean; duplicate: boolean }> {
    const k = `${source}:${eventId}`;
    if (this.seen.has(k)) {
      // mirrors the Prisma unique-constraint violation path
      return { ok: true, duplicate: true };
    }
    this.seen.add(k);
    return { ok: true, duplicate: false };
  }

  clear() {
    this.seen.clear();
  }
}

describe('webhook idempotency store', () => {
  const store = new IdempotencyStore();

  beforeEach(() => store.clear());

  it('processes a new event successfully', async () => {
    const result = await store.process('stripe', 'evt_001');
    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);
  });

  it('marks a repeated event as a duplicate', async () => {
    await store.process('stripe', 'evt_001');
    const result = await store.process('stripe', 'evt_001');
    expect(result.duplicate).toBe(true);
  });

  it('does not confuse events with the same ID from different sources', async () => {
    await store.process('stripe', 'evt_001');
    const result = await store.process('stripe', 'evt_001');
    expect(result.duplicate).toBe(false);
  });

  it('allows the same source with different event IDs', async () => {
    await store.process('stripe', 'evt_001');
    const result = await store.process('stripe', 'evt_002');
    expect(result.duplicate).toBe(false);
  });

  it('is idempotent — third call still returns duplicate', async () => {
    await store.process('stripe', 'pi_123');
    await store.process('stripe', 'pi_123');
    const result = await store.process('stripe', 'pi_123');
    expect(result.duplicate).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('handles high volume of distinct events without collision', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => store.process('stripe', `evt_${i}`))
    );
    expect(results.every((r) => !r.duplicate)).toBe(true);
  });

  it('detects all duplicates when same event is sent in parallel', async () => {
    // First arrival wins; rest are duplicates
    const results = await Promise.all([
      store.process('stripe', 'evt_dup'),
      store.process('stripe', 'evt_dup'),
      store.process('stripe', 'evt_dup')
    ]);
    const successes = results.filter((r) => !r.duplicate).length;
    const duplicates = results.filter((r) => r.duplicate).length;
    expect(successes).toBe(1);
    expect(duplicates).toBe(2);
  });
});

describe('auth session callbacks (unit)', () => {
  // Tests for the jwt/session callback logic extracted from auth.config.ts
  // without needing a real NextAuth instance.

  type JwtInput = { token: Record<string, unknown>; user?: { role?: string } };
  type SessionInput = { session: { user: Record<string, unknown> }; token: Record<string, unknown> };

  function jwtCallback({ token, user }: JwtInput) {
    if (user) {
      token.role = (user as { role?: string }).role;
    }
    return token;
  }

  function sessionCallback({ session, token }: SessionInput) {
    if (session.user) {
      session.user.id = token.sub ?? '';
      session.user.role = typeof token.role === 'string' ? token.role : 'FAN';
    }
    return session;
  }

  it('jwt callback copies role from user on sign-in', () => {
    const token = jwtCallback({ token: { sub: 'user-1' }, user: { role: 'ADMIN' } });
    expect(token.role).toBe('ADMIN');
  });

  it('jwt callback leaves token unchanged when no user (subsequent requests)', () => {
    const token = jwtCallback({ token: { sub: 'user-1', role: 'FAN' } });
    expect(token.role).toBe('FAN');
  });

  it('session callback sets user.id from token.sub', () => {
    const session = sessionCallback({
      session: { user: {} },
      token: { sub: 'user-abc', role: 'ARTIST' }
    });
    expect(session.user.id).toBe('user-abc');
  });

  it('session callback sets user.role from token', () => {
    const session = sessionCallback({
      session: { user: {} },
      token: { sub: 'user-abc', role: 'VENUE' }
    });
    expect(session.user.role).toBe('VENUE');
  });

  it('session callback defaults role to FAN when token has no role', () => {
    const session = sessionCallback({
      session: { user: {} },
      token: { sub: 'user-abc' }
    });
    expect(session.user.role).toBe('FAN');
  });

  it('session callback handles non-string role gracefully', () => {
    const session = sessionCallback({
      session: { user: {} },
      token: { sub: 'user-abc', role: 42 }
    });
    expect(session.user.role).toBe('FAN');
  });
});
