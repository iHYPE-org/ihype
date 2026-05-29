// Upgrade checklist for next-auth beta bumps:
//   1. Read https://github.com/nextauthjs/next-auth/releases for the target version.
//   2. Check for NextAuthConfig type changes (especially cookies, session, callbacks shapes).
//   3. Verify PrismaAdapter interface parity with the new @auth/prisma-adapter release.
//   4. Test the full OTP login flow and session persistence after the bump.
//   5. Update the pinned version in package.json overrides AND the dependency specifier.
import type { NextAuthConfig } from 'next-auth';
import { db } from '@/lib/db';

const useSecureCookies = process.env.NODE_ENV === 'production';
const sessionMaxAgeSeconds = 12 * 60 * 60;
const transientAuthCookieMaxAgeSeconds = 10 * 60;
const trustHost = process.env.AUTH_TRUST_HOST === 'true' || Boolean(process.env.AUTH_URL);

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login'
  },
  trustHost,
  useSecureCookies,
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: sessionMaxAgeSeconds
      }
    },
    callbackUrl: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: useSecureCookies,
        maxAge: transientAuthCookieMaxAgeSeconds
      }
    },
    csrfToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: useSecureCookies,
        maxAge: transientAuthCookieMaxAgeSeconds
      }
    },
    pkceCodeVerifier: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: useSecureCookies
      }
    },
    state: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: useSecureCookies
      }
    },
    nonce: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: useSecureCookies
      }
    },
    webauthnChallenge: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: useSecureCookies
      }
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: sessionMaxAgeSeconds,
    updateAge: 24 * 60 * 60
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
        const dbUser = await db.user.findUnique({
          where: { id: (user as { id?: string }).id ?? token.sub ?? '' },
          select: { userSecurityVersion: true }
        }).catch(() => null);
        token.securityVersion = dbUser?.userSecurityVersion ?? 0;
      } else if (trigger === 'update' && token.sub) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: { userSecurityVersion: true }
        }).catch(() => null);
        if (dbUser && typeof token.securityVersion === 'number' &&
            dbUser.userSecurityVersion !== token.securityVersion) {
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
  events: {
    async signIn({ user }) {
      // emailVerified enforcement is handled at the page level via /verify-email
      void user;
    }
  },
  providers: []
};
