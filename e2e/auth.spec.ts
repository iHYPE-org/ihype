import { test, expect } from '@playwright/test';

// Smoke test: OTP login flow → session established → workbench loads.
// Requires TEST_USER_EMAIL and TEST_USER_OTP env vars (set via .env.test or CI secrets).
// The test account must exist in the DB with a pre-seeded OTP (use scripts/reset-test-logins.mjs).

const EMAIL = process.env.TEST_USER_EMAIL ?? 'test@ihype.org';
const OTP   = process.env.TEST_USER_OTP   ?? '';

test.describe('Authentication', () => {
  test('OTP login → workbench loads', async ({ page }) => {
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

    // 5. Should land on /home (workbench)
    await expect(page).toHaveURL(/\/home/, { timeout: 15000 });

    // 6. Workbench shell is visible
    await expect(page.locator('.wb-root')).toBeVisible();

    // 7. No Internal Server Error
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('Unauthenticated /home redirects to /login', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('Authenticated /login redirects to /home', async ({ page, context }) => {
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
    await expect(page).toHaveURL(/\/home/, { timeout: 8000 });
  });
});
