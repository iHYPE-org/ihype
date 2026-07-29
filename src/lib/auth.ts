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
            select: { userSecurityVersion: true }
          });
          if (!dbUser) return null;
          token.securityVersion = dbUser.userSecurityVersion;
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
            select: { userSecurityVersion: true }
          });
          if (!dbUser || dbUser.userSecurityVersion !== (token.securityVersion ?? 0)) return null;
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
      }
      return session;
    }
  },
  providers: []
});
