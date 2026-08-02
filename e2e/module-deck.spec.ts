import { expect, test, type BrowserContext } from '@playwright/test';
import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';

const EMAIL = 'e2e-module-deck@ihype.org';

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

async function signIn(context: BrowserContext) {
  const { cookie } = await seedSessionCookie(EMAIL);
  await context.addCookies([{
    name: sessionCookieName(),
    value: cookie,
    domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
    path: '/',
    secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
  }]);
}

test.describe('Signed-in module deck interactions', () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context);
    await page.addInitScript(() => window.localStorage.setItem('ihype:module-guide-seen', '1'));
  });

  test('navigates every primary module and exposes queue and alpha feedback', async ({ page }) => {
    await page.goto('/listen');
    await expect(page.locator('.module-deck-preview')).toBeVisible({ timeout: 20_000 });

    for (const [label, selector] of [
      ['Discover', '.discover-module'],
      ['Radio', '.radio-module'],
      ['Dashboard', '.dashboard-module'],
      ['Settings', '.settings-module'],
      ['Community', '.community-module'],
      ['Around you', '.deck-map-module'],
    ] as const) {
      await page.getByRole('button', { name: /iHYPE module navigator/ }).click();
      await page.locator('.deck-navigator').getByRole('button', { name: new RegExp(label, 'i') }).click();
      await expect(page.locator(selector)).toBeVisible({ timeout: 5_000 });
    }

    await page.getByRole('button', { name: 'Open play queue' }).click();
    await expect(page.locator('.deck-player-queue')).toBeVisible();

    await page.getByRole('button', { name: 'Open account menu' }).click();
    await expect(page.getByRole('link', { name: /Send alpha feedback/ })).toHaveAttribute('href', /alpha=1&module=map/);
  });

  test('keeps the navigator, global search, account menu, and player usable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/listen');
    await expect(page.locator('.module-deck-preview')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('textbox', { name: 'Search iHYPE' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous song' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next song' })).toBeVisible();

    await page.getByRole('button', { name: /iHYPE module navigator/ }).click();
    await page.locator('.deck-navigator').getByRole('button', { name: /Settings/i }).click();
    await expect(page.locator('.settings-module')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await expect(page.getByRole('link', { name: /Send alpha feedback/ })).toBeVisible();
  });
});
