// next-auth is pinned to 5.0.0-beta.31 — do not bump without reading the beta
// changelog for session/jwt callback shape changes, adapter interface changes,
// and cookie config renames. @auth/prisma-adapter must be bumped together.
//
// Sign-in never actually goes through NextAuth's provider/signIn() flow —
// passkey and magic-link both verify out-of-band (WebAuthn assertion, emailed
// token) and build a NextAuth-compatible session cookie directly via
// buildAuthSessionCookie (src/lib/auth-session.ts) so `auth()` below still
// works. NextAuth itself is used only for session reading/JWT handling, so
// `providers` is intentionally empty.
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';
import { log } from '@/lib/logger';
import { readImpersonatorId } from '@/lib/impersonation';
import { isAllowedAdminEmail } from '@/lib/admin-allowlist';
import { readRuntimeEnv } from '@/lib/runtime-env';

/**
 * ADMIN is granted by the User row, but ALLOWED by the address on it.
 *
 * Clamped here, in the jwt callback, because `token.role` is the single source
 * every consumer reads: `isAdminSession()`, the `/admin` layout, the middleware
 * matcher, and the two Stripe routes that compare `session.user.role` directly
 * rather than going through the helper. Patching the helper alone would have
 * left those two. A row whose role says ADMIN but whose email is not on the
 * allowlist is downgraded to FAN for the life of the session — the database is
 * not rewritten, because this is an authorisation rule, not a migration, and
 * silently editing roles would destroy the evidence that one was wrong.
 */
function clampAdminRole(role: string | undefined, email: string | null | undefined): string | undefined {
  if (role !== 'ADMIN') return role;
  if (isAllowedAdminEmail(email, readRuntimeEnv('ADMIN_ALLOWED_EMAILS'))) return role;
  log.error(
    '[auth] ADMIN role refused — address is not on the admin allowlist',
    { email: email ?? null },
    'error',
  );
  return 'FAN';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
        try {
          const dbUser = await db.user.findUnique({
            where: { id: (user as { id?: string }).id ?? token.sub ?? '' },
            select: { userSecurityVersion: true, email: true }
          });
          if (!dbUser) return null;
          token.securityVersion = dbUser.userSecurityVersion;
          token.role = clampAdminRole(token.role, dbUser.email);
        } catch (err) {
          log.error('[auth]', err instanceof Error ? err : { error: String(err) }, 'Unable to read user security version during sign-in');
          return null;
        }
      } else if (token.sub) {
        // Check security version on every full auth() call so suspensions and
        // password changes take effect. Not checked in middleware (no DB there).
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.sub },
            select: { userSecurityVersion: true, email: true }
          });
          if (!dbUser || dbUser.userSecurityVersion !== (token.securityVersion ?? 0)) return null;
          // Re-checked on EVERY auth() call, not only at sign-in, for the same
          // reason securityVersion is: a token minted before the rule existed,
          // or before an address left the allowlist, must stop being an admin
          // token without waiting for it to expire.
          token.role = clampAdminRole(token.role, dbUser.email);
        } catch (err) {
          log.error('[auth]', err instanceof Error ? err : { error: String(err) }, 'Unable to validate user security version');
          return null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = typeof token.role === 'string' ? token.role : 'FAN';
        (session.user as { emailVerified?: Date | null }).emailVerified =
          token.emailVerified ? new Date(token.emailVerified as string) : null;
        // Surfaced so the banner can render and the exit route can authorise.
        // Read through the guard rather than cast: a claim that is not a
        // non-empty string is not an impersonation and must never reach a
        // lookup as a user id.
        (session.user as { impersonatorId?: string | null }).impersonatorId =
          readImpersonatorId(token as unknown as Record<string, unknown>);
      }
      return session;
    }
  },
  providers: []
});
