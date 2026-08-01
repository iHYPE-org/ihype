import { createHash } from 'node:crypto';
import { PrismaClient, type Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { encode } from 'next-auth/jwt';

/**
 * Mints a real signed session for an e2e test, instead of depending on a
 * hand-minted `TEST_SESSION_COOKIE` secret.
 *
 * Why this exists: every authenticated spec in this suite is gated on that
 * secret and calls `test.skip()` when it is absent. That is fine for tests
 * whose job is to prove a flow still works — a skip is visible. It is NOT fine
 * for the app-shell contract tests, whose whole purpose is to fail when someone
 * breaks a rule that nothing else enforces. A suite that silently skips is the
 * same failure mode as a check that always passes.
 *
 * The token shape is not guesswork: it mirrors `buildAuthSessionCookie`
 * (src/lib/auth-session.ts), which is what the app's own magic-link and passkey
 * sign-ins use. The claim that matters is `securityVersion` — `auth()`'s jwt
 * callback (src/lib/auth.ts) re-reads `User.userSecurityVersion` on every call
 * and returns null if it disagrees, so the value has to come from the row, not
 * a constant.
 *
 * Deliberately uses its own PrismaClient rather than `@/lib/db`: that module
 * imports the wasm/workerd query engine on purpose (see the comment at the top
 * of it), which cannot load in a plain Node test process. This client talks to
 * the same scratch database the workerd instance under test is pointed at,
 * over the node-postgres driver adapter — Prisma 7 rejects a bare
 * `new PrismaClient()`, and both `datasources` and `datasourceUrl` are gone,
 * so this mirrors prisma/seed.ts rather than inventing a third pattern.
 */

const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60; // AUTH_SESSION_MAX_AGE_SECONDS

export type SeededUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type ShellFixtureOptions = {
  /** Creator profiles to attach, which is what the drawer's role gates read. */
  profiles?: { type: 'ARTIST' | 'DJ' | 'VENUE'; name: string }[];
  role?: Role;
};

function databaseUrl() {
  const url = process.env.E2E_WORKERD_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('E2E_WORKERD_DATABASE_URL (or DATABASE_URL) must be set to seed a session.');
  return url;
}

export function sessionCookieName() {
  return process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}

/**
 * Creates (or reuses) a user plus any requested creator profiles, and returns a
 * cookie value `auth()` will accept.
 */
export async function seedSessionCookie(
  email: string,
  options: ShellFixtureOptions = {},
): Promise<{ cookie: string; user: SeededUser }> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be set to sign an e2e session.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    const role: Role = options.role ?? 'FAN';
    const name = email.split('@')[0];
    // `username` is non-null and unique in the schema; derive it from the
    // address so re-running a spec reuses the same row instead of colliding.
    const username = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { email, name, username, role, emailVerified: new Date() },
      select: { id: true, email: true, name: true, role: true, userSecurityVersion: true, emailVerified: true },
    });

    for (const profile of options.profiles ?? []) {
      // Slug is derived from the user id so repeated runs are idempotent and
      // two concurrently-seeded users cannot collide on it.
      const slug = `e2e-${profile.type.toLowerCase()}-${user.id.slice(0, 8)}`;
      // hexId is non-null and unique too, and is what /invite/[hexId] and the
      // embed route look profiles up by. Derived from the same seed as the slug
      // so it is stable across runs.
      const hexId = `0x${createHash('sha256').update(slug).digest('hex').slice(0, 32)}`;
      await prisma.profile.upsert({
        where: { slug },
        update: {},
        create: { slug, hexId, name: profile.name, type: profile.type, ownerId: user.id, genres: [] },
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const cookieName = sessionCookieName();
    const cookie = await encode({
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        picture: null,
        role: user.role,
        emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
        securityVersion: user.userSecurityVersion,
        iat: now,
        exp: now + COOKIE_MAX_AGE_SECONDS,
        jti: crypto.randomUUID(),
      },
      secret,
      // The salt MUST be the cookie name — NextAuth derives the encryption key
      // from (secret, salt), so a mismatch decodes to nothing and every request
      // silently 401s rather than erroring anywhere visible.
      salt: cookieName,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return {
      cookie,
      user: { id: user.id, email: user.email!, name: user.name!, role: user.role },
    };
  } finally {
    await prisma.$disconnect();
  }
}

/** True when this environment can seed its own session. */
export function canSeedSession() {
  return Boolean(
    (process.env.E2E_WORKERD_DATABASE_URL || process.env.DATABASE_URL) &&
    (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
  );
}
