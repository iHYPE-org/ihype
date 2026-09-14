import { expect, test } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * The public header's search bar posted to `/search` until 2026-09-14 — a
 * redirects() alias onto `/app/music/discover?focus=search` whose destination
 * DROPS the query: a member typed a name, pressed Enter, and arrived at an
 * empty field with nothing to say why (DESIGN_SYNC row 415). The bar posts to
 * the discover tab directly now, with `focus=search` as a hidden field, and
 * the tab prefills its own field from `q`.
 *
 * Signed in on purpose: the header shows the bar to members only (the landing
 * page's own smoke test asserts it is absent signed out), and the discover tab
 * is behind the auth gate.
 */
test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

test('the header search carries the query into the discover tab', async ({ page, context }) => {
  await applySessionCookie(context, 'search-probe@example.com');
  await page.goto('/info');
  /* Two controls, one destination. Desktop shows the inline form (a plain GET,
     so the hidden `focus` field is what carries the mode); a phone shows an
     icon that opens an overlay whose submit goes through `router.push`. Each
     path built its own URL, and each used to build the alias. */
  const desktop = page.locator('.search-bar-desktop input[name="q"]');
  const trigger = page.locator('.search-bar-mobile-trigger');
  // The header draws the bar only once `useSession()` has resolved — wait for
  // whichever control this viewport shows rather than reading visibility at t=0.
  await expect(desktop.or(trigger).first()).toBeVisible({ timeout: 15_000 });
  if (await desktop.isVisible()) {
    await desktop.fill('neon');
    await desktop.press('Enter');
  } else {
    await page.locator('.search-bar-mobile-trigger').click();
    const overlay = page.locator('.search-bar-overlay-input');
    await expect(overlay).toBeVisible();
    await overlay.fill('neon');
    await overlay.press('Enter');
  }
  await expect(page).toHaveURL(/\/app\/music\/discover\?(?:[^#]*&)?focus=search(?:&|$)/);
  await expect(page).toHaveURL(/[?&]q=neon(?:&|$)/);
  // The search field on the destination carries the words the member typed.
  await expect(page.locator('.mmm-search-input')).toHaveValue('neon');
});
