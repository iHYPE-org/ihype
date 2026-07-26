import { test, expect } from '@playwright/test';

// Passkey registration + discoverable-credential sign-in, using Chromium's
// built-in CDP WebAuthn virtual authenticator (no real hardware key or
// platform authenticator needed — this is Chromium's own supported testing
// mechanism for WebAuthn: https://developer.chrome.com/docs/devtools/webauthn).
//
// Reuses TEST_SESSION_COOKIE, the same secret auth.spec.ts's "Authenticated
// /login redirects to /home" test already depends on, to reach /settings
// authenticated without a magic-link/OTP round trip. Requires the seeded
// test account to have zero passkeys registered at test start (matches
// scripts/reset-test-logins.mjs's role in CI) — if it already has one from
// a prior run, the "Add a passkey" step's assertion for the new entry
// showing up will still pass (it just becomes a 2nd entry), but the
// sign-in step further down authenticates with whichever discoverable
// credential the browser offers, so a stale leftover credential from an
// earlier failed run could make this flaky. Safe to leave — it's small dev
// hygiene, not a masking issue: a genuinely broken passkey flow still fails
// loudly rather than silently passing.
test.describe('Passkey registration and sign-in', () => {
  test('register a passkey in Settings, then sign in with it', async ({ page, context }) => {
    const sessionCookie = process.env.TEST_SESSION_COOKIE;
    if (!sessionCookie) {
      test.skip(true, 'TEST_SESSION_COOKIE not set — skipping (see auth.spec.ts for the same gate)');
      return;
    }

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
      name: 'authjs.session-token',
      value: sessionCookie,
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
      path: '/',
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
    await expect(page.getByRole('button', { name: /sign in with passkey/i })).toBeVisible();
    await page.getByRole('button', { name: /sign in with passkey/i }).click();

    await expect(page).toHaveURL(/\/home/, { timeout: 15000 });
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  });
});
