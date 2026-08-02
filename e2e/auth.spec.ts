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

    // 2. AuthLogin.tsx defaults to the passkey tab whenever
    // window.PublicKeyCredential exists (true in a real Chromium browser
    // even with no authenticator registered) — the email field only renders
    // after switching to the magic-link tab.
    await page.getByRole('button', { name: /email me a magic link/i }).click();

    // 3. Submit email — AuthLogin.tsx's email field has no <label>/aria-label
    // association (just a placeholder), so its accessible name doesn't
    // contain "email" and getByRole(..., {name: /email/i}) can't find it.
    await page.getByPlaceholder('you@example.com').fill(EMAIL);
    await page.getByRole('button', { name: /send sign-in link/i }).click();

    // 4. "Check your email" confirmation appears
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: 8000 });

    // 5. No Internal Server Error
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('Unauthenticated /listen redirects to /login', async ({ page }) => {
    // /listen is WORKBENCH_PATH (src/lib/auth-redirects.ts) — the actual
    // route middleware gates on. Verified directly: unauthenticated /listen
    // returns a 307 to /login?callbackUrl=%2Flisten.
    //
    // /home (the previous target of this test) is NOT equivalent: it's just
    // a legacy alias page that unconditionally calls redirect('/listen')
    // regardless of auth state, so it isn't useful as an auth-gate check —
    // that redirect fires from inside a Suspense boundary (loading.tsx),
    // so it's encoded as a NEXT_REDIRECT marker for client-side hydration to
    // process rather than a raw HTTP 307 (visible directly with curl, which
    // has no JS and so never follows it) — confirmed working correctly and
    // consistently in a real browser across repeated runs, not a bug.
    await page.goto('/listen');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('Authenticated /login redirects to /listen', async ({ page, context }) => {
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
    await expect(page).toHaveURL(/\/listen/, { timeout: 8000 });
  });
});
