import AxeBuilder from '@axe-core/playwright';
import { test, expect, type BrowserContext } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * The quick-start guide (`MmmGettingStarted`).
 *
 * It opens by itself once per browser session for a real member, and NOT in
 * an automated browser (every other spec starts as a fresh account and would
 * otherwise be testing a dialog). So this spec opens it the way a member does
 * after dismissing it: `?guide=1`, the link behind ME → Info → "How to use
 * iHYPE". Environment: through `node scripts/e2e-workerd.mjs`.
 */

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

async function signIn(context: BrowserContext, email: string, profiles?: { type: 'ARTIST' | 'VENUE'; name: string }[]) {
  await applySessionCookie(context, email, { profiles });
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
  });
}

test('an artist gets their four setup steps, each linking into the editor', async ({ context, page }) => {
  await signIn(context, `e2e-guide-artist-${Date.now()}@ihype.org`, [{ type: 'ARTIST', name: 'Guide Test Band' }]);
  /* The dialog exists only once /api/me/getting-started has answered, and
     this test is the first request a cold worker serves: the pane's render,
     hydration, the route module's first load and its Prisma reads all land
     inside the same 5 s the assertion below allows. Wait for the read itself
     and assert it was OK — a 503 opens the dialog under the fan heading, which
     the locator would report as "not found" (flaked once, 2026-09-28). */
  const guideRead = page.waitForResponse((r) => r.url().includes('/api/me/getting-started'));
  await page.goto('/app/me?guide=1');
  expect((await guideRead).ok()).toBe(true);

  const dialog = page.getByRole('dialog', { name: 'Get your artist page ready' });
  await expect(dialog).toBeVisible();
  const steps = dialog.locator('.mmm-guide-step');
  await expect(steps).toHaveCount(4);
  await expect(steps.first()).toHaveAttribute('href', /\/app\/me\/profiles\?profile=.+&editor=about/);
  await expect(steps.nth(1)).toHaveAttribute('href', /editor=media/);
  await expect(dialog.getByText('0 of 4 done')).toBeVisible();
  // An artist who has not finished the wizard is offered it.
  await expect(dialog.getByRole('link', { name: 'Or do it all in the guided setup' })).toHaveAttribute('href', /\/app\/me\/artists\/.+\/onboarding/);

  const axe = await new AxeBuilder({ page }).include('.mmm-guide').analyze();
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => v.id)).toEqual([]);

  // "Don't show this again" is remembered, and closing clears the query.
  await dialog.getByLabel("Don't show this again").check();
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/guide=1/);
  const hidden = await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('ihype:getting-started:hidden:')));
  expect(hidden).toBe(true);
});

test('a venue gets its own steps, Stripe among them', async ({ context, page }) => {
  await signIn(context, `e2e-guide-venue-${Date.now()}@ihype.org`, [{ type: 'VENUE', name: 'Guide Test Room' }]);
  await page.goto('/app/map?guide=1');
  const dialog = page.getByRole('dialog', { name: 'Get your venue ready' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.mmm-guide-step')).toHaveCount(5);
  await expect(dialog.getByRole('link', { name: /Set up Stripe/ })).toHaveAttribute('href', '/app/me/payouts?tab=settings');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('a fan gets the tour, and ME → Info reopens it', async ({ context, page }) => {
  await signIn(context, `e2e-guide-fan-${Date.now()}@ihype.org`);
  await page.goto('/app/me?panel=info');
  const row = page.getByRole('link', { name: /How to use iHYPE/ });
  await expect(row).toHaveAttribute('href', '/app/me?guide=1');
  await row.click();
  const dialog = page.getByRole('dialog', { name: 'How iHYPE works' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.mmm-guide-step')).toHaveCount(4);
});
