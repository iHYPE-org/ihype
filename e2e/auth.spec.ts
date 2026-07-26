import { test, expect } from '@playwright/test';

// Smoke test: OTP login flow → session established → Listen loads.
// Requires TEST_USER_EMAIL and TEST_USER_OTP env vars (set via .env.test or CI secrets).
// The test account must exist in the DB with a pre-seeded OTP (use scripts/reset-test-logins.mjs).
//
// IMPORTANT — this suite (and any authenticated e2e test) cannot currently
// pass against this repo's default `npm run dev` webServer (playwright.config.ts),
// even with valid secrets: src/lib/db.ts intentionally imports
// `@prisma/client/edge` (wasm/workerd query engine) rather than the plain
// Node engine, to avoid a documented prior production outage — see the
// comment at the top of db.ts and public-smoke.spec.ts's health-check test.
// That engine cannot load under plain `next dev`, so any DB read inside
// auth()'s jwt callback (which runs on every request, not just sign-in)
// throws, and every authenticated request 401s. Verified directly: running
// these tests against a real `wrangler dev` (workerd) instance with a
// matching DATABASE_URL/AUTH_SECRET/NEXT_PUBLIC_BASE_URL works correctly end
// to end. Against plain `next dev`, expect this whole suite to fail once
// TEST_USER_OTP/TEST_SESSION_COOKIE are actually supplied — that's this test
// infra's own environment gap, not a defect in the auth flow itself.

const EMAIL = process.env.TEST_USER_EMAIL ?? 'test@ihype.org';
const OTP   = process.env.TEST_USER_OTP   ?? '';

test.describe('Authentication', () => {
  test('OTP login → Listen loads', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page).toHaveTitle(/iHYPE/i);

    // 2. Submit email
    await page.getByRole('textbox', { name: /email/i }).fill(EMAIL);
    await page.getByRole('button', { name: /send|continue|sign in/i }).click();

    // 3. OTP challenge screen appears
    await expect(page.getByRole('textbox', { name: /code|otp|one.time/i })).toBeVisible({ timeout: 8000 });

    if (!OTP) {
      test.skip(true, 'TEST_USER_OTP not set — skipping OTP entry');
      return;
    }

    // 4. Enter OTP
    await page.getByRole('textbox', { name: /code|otp|one.time/i }).fill(OTP);
    await page.getByRole('button', { name: /verify|confirm|sign in/i }).click();

    // 5. Should land on /listen (WORKBENCH_PATH, src/lib/auth-redirects.ts) —
    // the old Workbench system's /home target was retired; /home is now
    // just a legacy alias that itself forwards to /listen.
    await expect(page).toHaveURL(/\/listen/, { timeout: 15000 });

    // 6. No Internal Server Error
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('Unauthenticated /listen redirects to /login', async ({ page }) => {
    // /listen is WORKBENCH_PATH (src/lib/auth-redirects.ts) — the actual
    // route middleware gates on. Verified directly: unauthenticated /listen
    // returns a 307 to /login?callbackUrl=%2Flisten.
    //
    // /home (the previous target of this test) is NOT equivalent: it's now
    // just a legacy alias page that unconditionally calls redirect('/listen')
    // regardless of auth state — not useful as an auth-gate check — and in
    // manual testing its redirect didn't reliably update the browser's
    // address bar even though the underlying navigation/content did change,
    // which looks like a separate, real bug in that legacy route worth its
    // own investigation rather than asserting on here.
    await page.goto('/listen');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('Authenticated /login redirects to /listen', async ({ page, context }) => {
    // Seed a session cookie if available, else skip
    const sessionCookie = process.env.TEST_SESSION_COOKIE;
    if (!sessionCookie) {
      test.skip(true, 'TEST_SESSION_COOKIE not set');
      return;
    }
    await context.addCookies([{
      name: 'authjs.session-token',
      value: sessionCookie,
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
      path: '/',
    }]);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/listen/, { timeout: 8000 });
  });
});
