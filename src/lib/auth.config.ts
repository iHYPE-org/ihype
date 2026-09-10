// Upgrade checklist for next-auth beta bumps:
//   1. Read the release notes for the target version.
//   2. Check NextAuthConfig changes, especially cookie, JWT, and callback shapes.
//   3. Verify Prisma adapter parity.
//   4. Run the OTP, magic-link, passkey, and session persistence tests.
//   5. Update the pinned dependency and override together.
//
// Edge-safe: this file is imported by middleware and must not import Node-only modules.
import type { NextAuthConfig } from 'next-auth';
import { orderSigningSecrets } from '@/lib/signing-secret-order';
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  AUTH_TRANSIENT_COOKIE_MAX_AGE_SECONDS,
  getAuthSessionCookieName,
  getAuthSessionCookieOptions,
  useSecureAuthCookies,
} from '@/lib/auth-cookie';

const useSecureCookies = useSecureAuthCookies();
const trustHost = process.env.AUTH_TRUST_HOST === 'true' || Boolean(process.env.AUTH_URL);

const transientCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/api/auth',
  secure: useSecureCookies,
  maxAge: AUTH_TRANSIENT_COOKIE_MAX_AGE_SECONDS,
};

/* NEXT-AUTH NEVER READS THE ROTATION SECRETS, AND LEAVING IT TO DO SO LOCKS
   EVERY MEMBER OUT (2026-09-10).

   `next-auth/lib/env.js` runs `config.secret ??= process.env.AUTH_SECRET`,
   which sets a STRING, and only then calls `@auth/core`'s own
   `setEnvDefaults`. The core assembles `AUTH_SECRET_1..3` into an array —
   but behind `if (!config.secret?.length)`, and a non-empty string has a
   length, so that branch never runs. The numbered secrets are read by
   `@auth/core` alone and this app is on the next-auth wrapper.

   So without this line the session cookie is SIGNED with the newest key
   (`currentSigningSecret()`) and VERIFIED against the oldest, which is not a
   degraded rotation, it is every member signed out and unable to sign back
   in — on the only auth path this product has. Passing the array explicitly
   also stops both `setEnvDefaults` from touching it, since it is already set.

   `process.env` and not `readRuntimeEnv`: this file is imported by middleware
   and must not reach for the Cloudflare context, and the value is read at
   module scope where no request context exists anyway. The consequence is the
   one thing the runbook has to say out loud — a rotation secret must be set
   the same way `AUTH_SECRET` itself is, or the verifier cannot see it while
   the signer can. `/api/health` reports the count each side sees so that is
   checked rather than assumed. */
export const authConfig: NextAuthConfig = {
  secret: orderSigningSecrets(process.env),
  pages: {
    signIn: '/login',
  },
  trustHost,
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: getAuthSessionCookieName(),
      options: getAuthSessionCookieOptions(),
    },
    callbackUrl: {
      options: transientCookieOptions,
    },
    csrfToken: {
      options: transientCookieOptions,
    },
    pkceCodeVerifier: {
      options: {
        ...transientCookieOptions,
        maxAge: undefined,
      },
    },
    state: {
      options: {
        ...transientCookieOptions,
        maxAge: undefined,
      },
    },
    nonce: {
      options: {
        ...transientCookieOptions,
        maxAge: undefined,
      },
    },
    webauthnChallenge: {
      options: {
        ...transientCookieOptions,
        maxAge: undefined,
      },
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    updateAge: 24 * 60 * 60,
  },
  events: {
    async signIn({ user }) {
      void user;
    },
  },
  providers: [],
};
