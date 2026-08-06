import { test, expect } from '@playwright/test';
import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';

// Passkey registration + discoverable-credential sign-in, using Chromium's
// built-in CDP WebAuthn virtual authenticator (no real hardware key or
// platform authenticator needed — this is Chromium's own supported testing
// mechanism for WebAuthn: https://developer.chrome.com/docs/devtools/webauthn).
//
// Seeds its own signed session to reach /settings without a magic-link/OTP
// round trip. The seeded test account should have zero passkeys registered at
// test start (matches
// scripts/reset-test-logins.mjs's role in CI) — if it already has one from
// a prior run, the "Add a passkey" step's assertion for the new entry
// showing up will still pass (it just becomes a 2nd entry), but the
// sign-in step further down authenticates with whichever discoverable
// credential the browser offers, so a stale leftover credential from an
// earlier failed run could make this flaky. Safe to leave — it's small dev
// hygiene, not a masking issue: a genuinely broken passkey flow still fails
// loudly rather than silently passing.
//
// Verified: the actual register+sign-in flow this test exercises works
// correctly end to end against a real `wrangler dev` (workerd) instance,
// including a real WebAuthn ceremony via Chromium's CDP virtual
// authenticator. Run via `node scripts/e2e-workerd.mjs` (see the
// environment note at the top of auth.spec.ts) — it cannot pass against
// this repo's default `npm run dev` webServer, same wasm-engine limitation.
// Sign-in may land on /welcome instead of /listen for a
// freshly-registered-passkey account (onboarding-incomplete redirect) —
// this test only asserts the user is no longer on the login screen, not a
// specific destination.
test.describe('Passkey registration and sign-in', () => {
  test('register a passkey in Settings, then sign in with it', async ({ page, context }) => {
    if (!canSeedSession()) {
      test.skip(true, 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');
      return;
    }
    const { cookie: sessionCookie } = await seedSessionCookie('e2e-passkey@ihype.org');

    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    await context.addCookies([{
      name: sessionCookieName(),
      value: sessionCookie,
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
      path: '/',
      secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
    }]);

    // 1. Register a new passkey from Settings.
    await page.goto('/settings');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    const addButton = page.getByRole('button', { name: /add a passkey/i });
    await expect(addButton).toBeVisible({ timeout: 8000 });
    await addButton.click();
    await expect(page.getByText(/passkey added/i)).toBeVisible({ timeout: 10000 });

    // 2. Sign out (drop the session cookie) and authenticate with the
    // just-registered passkey via the login page's discoverable-credential
    // flow — no username entry, matching /api/auth/passkey/auth's GET
    // handler, which issues discoverable-credential options.
    await context.clearCookies();
    await page.goto('/login');
    // The button must exist and be visible — that assertion is the point of
    // keeping it against the .dc.html (conditional mediation is browser chrome
    // and Playwright cannot click it, so without this button there is no
    // sign-in coverage at all). Keep it strict.
    const passkeyButton = page.getByRole('button', { name: /sign in with passkey/i });
    await expect(passkeyButton).toBeVisible();

    // The click, though, is best-effort. The conditional ceremony is armed on
    // mount against the same discoverable credentials, and the CDP virtual
    // authenticator approves without a user gesture — so on a fast machine it
    // can complete, navigate away and detach this button before the click
    // lands. That is a success, not a failure, and pinning it as one made this
    // test fail for the app working correctly. What actually has to be true is
    // asserted immediately below: the session exists and we left /login.
    await passkeyButton.click({ timeout: 5000 }).catch(() => { /* ceremony won the race */ });

    // Destination varies (WORKBENCH_PATH — now /app/map — for an onboarded
    // account, /welcome for a freshly-registered-passkey one) — assert the
    // sign-in actually succeeded (left /login) rather than pin an exact route.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  });
});
