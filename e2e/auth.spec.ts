import { test, expect } from '@playwright/test';
import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';

// Smoke test: magic-link send flow reaches its confirmation screen.
// Requires TEST_USER_EMAIL (set via .env.test or CI secrets); falls back to
// a fixed address if unset since this test never actually completes sign-in
// (see below).
//
// IMPORTANT — this suite (and any authenticated e2e test) cannot pass
// against this repo's default `npm run dev` webServer (playwright.config.ts),
// even with valid secrets: src/lib/db.ts intentionally imports
// `@prisma/client/edge` (wasm/workerd query engine) rather than the plain
// Node engine, to avoid a documented prior production outage — see the
// comment at the top of db.ts and public-smoke.spec.ts's health-check test.
// That engine cannot load under plain `next dev`, so any DB read inside
// auth()'s jwt callback (which runs on every request, not just sign-in)
// throws, and every authenticated request 401s.
//
// Run this suite via `node scripts/e2e-workerd.mjs` instead (a real
// `wrangler dev` instance) — verified working end to end. CI's "Mandatory
// authenticated E2E suite" step uses that script for exactly this reason.
//
// PLAYWRIGHT_AUTH_COOKIE_SECURE=true (set by scripts/e2e-workerd.mjs) picks
// the __Secure- prefixed cookie name that NextAuth uses when
// useSecureAuthCookies() (src/lib/auth-cookie.ts) is true, which it always
// is under the built worker (production semantics), unlike plain `next dev`.

const EMAIL = process.env.TEST_USER_EMAIL ?? 'test@ihype.org';

test.describe('Authentication', () => {
  test('magic-link send reaches its confirmation screen', async ({ page }) => {
    // This app's magic-link flow (src/components/AuthLogin.tsx) has no
    // manual OTP-code entry step at all — sendMagicLink() just flips to a
    // static "Check your email" confirmation (mlSent state). There is no
    // way to complete sign-in from here without reading a real inbox, so
    // this test only verifies the send path reaches that confirmation, not
    // a full login — full session establishment is covered separately by
    // the self-seeded session test below and by passkey.spec.ts.

    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page).toHaveTitle(/iHYPE/i);

    // 2. Sign-in is single-step as of the Auth.dc.html sync: one email field
    // and one Continue button, no passkey/magic-link tab strip to switch
    // between. The passkey path runs as a WebAuthn conditional ceremony
    // armed on the same field (autocomplete="username webauthn"), which is
    // invisible to this test — with no authenticator registered the browser
    // simply offers nothing, and typing an address is the email path.
    //
    // 3. The field now has a real <label for>, so it can be addressed by
    // accessible name rather than by placeholder.
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByRole('button', { name: /^continue$/i }).click();

    // 4. "Check your email" confirmation appears
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: 8000 });

    // 5. No Internal Server Error
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('Unauthenticated /app/map redirects to /login', async ({ page }) => {
    // `/app/map` is WORKBENCH_PATH (src/lib/auth-redirects.ts) and the route
    // middleware actually gates on. This used to test `/listen`, which was
    // WORKBENCH_PATH before the shell cut-over and is now only a redirect into
    // it — still gated, but testing it would assert a redirect chain rather
    // than the auth gate.
    //
    // /home is NOT equivalent and was rejected as a target for the same reason
    // it was before: it is a legacy alias that calls redirect() unconditionally,
    // regardless of auth state, from inside a Suspense boundary (loading.tsx).
    // That is encoded as a NEXT_REDIRECT marker for client-side hydration
    // rather than a raw HTTP 307 — invisible to curl, which has no JS, and so
    // useless as an auth-gate check.
    await page.goto('/app/map');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('Authenticated /login redirects to the app surface', async ({ page, context }) => {
    if (!canSeedSession()) {
      test.skip(true, 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');
      return;
    }
    const { cookie: sessionCookie } = await seedSessionCookie('e2e-auth-redirect@ihype.org');
    await context.addCookies([{
      name: sessionCookieName(),
      value: sessionCookie,
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
      path: '/',
      secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
    }]);
    await page.goto('/login');
    // WORKBENCH_PATH, which is now /app/map (DESIGN_SYNC row 269) rather than
    // /listen. Middleware sends an already-signed-in visitor there instead of
    // rendering the sign-in form again.
    await expect(page).toHaveURL(/\/app\/map/, { timeout: 8000 });
  });
});
