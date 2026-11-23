import { expect, test } from '@playwright/test';

test.describe('Public application smoke', () => {
  test('landing and login pages render without server errors', async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrated|hydration mismatch/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });

    for (const path of ['/', '/login']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return a successful response`).toBeLessThan(400);
      await expect(page).toHaveTitle(/iHYPE/i);
      await expect(page.locator('body')).not.toContainText('Internal Server Error');
    }

    expect(hydrationErrors, 'public auth surfaces should hydrate without React mismatches').toEqual([]);
  });

  test('the home alias enters canonical MMM and anonymous MMM requires login', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
  });

  test('anonymous landing has three sections and no playback controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-dock')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /play now|pause/i })).toHaveCount(0);
    const landing = page.locator('.fan-entry');
    const sections = landing.locator('section');
    await expect(sections).toHaveCount(3);
    expect(await sections.evaluateAll((elements) => elements.map(({ id }) => id))).toEqual([
      'mission', 'story', 'transparency',
    ]);
    const sectionNav = landing.getByRole('navigation', { name: 'On this page' });
    const links = sectionNav.getByRole('link');
    await expect(links).toHaveText(['Mission', 'Our story', 'Transparency']);
    expect(await links.evaluateAll((elements) => elements.map((link) => link.getAttribute('href')))).toEqual([
      '#mission', '#story', '#transparency',
    ]);
    await expect(landing.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    await expect(landing.locator('audio, form')).toHaveCount(0);
    await expect(page.locator('.search-bar-desktop')).toHaveCount(0);
  });

  test('public health endpoint reports a truthful liveness probe', async ({ request }) => {
    // The endpoint runs a real DB check for unauthenticated callers (a
    // hardcoded 200 previously let a real production outage go undetected —
    // see DESIGN_SYNC history). This suite runs against `next dev`, which
    // cannot load the `@prisma/client/wasm` engine at all (a longstanding,
    // workerd-only requirement of this project — see scripts/workerd-smoke.mjs),
    // so the DB check here always reports degraded; that's the correct,
    // truthful behavior for this environment, not a bug. The real, DB-backed
    // 200 case is covered by the Workerd smoke stage instead.
    const response = await request.get('/api/health');
    expect([200, 503]).toContain(response.status());
    await expect(response.json()).resolves.toMatchObject({
      status: response.status() === 200 ? 'ok' : 'degraded',
      scope: 'liveness',
    });
  });
});
