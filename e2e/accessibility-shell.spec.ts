import AxeBuilder from '@axe-core/playwright';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * THE SIGNED-IN SHELL HAS NEVER BEEN RUN THROUGH AXE.
 *
 * `accessibility.spec.ts` covers four SIGNED-OUT pages — `/`, `/login`,
 * `/register`, `/info` — plus one public show page. That is the marketing
 * surface. The product is the 46 routes under `/app/*`, and no automated
 * accessibility check has ever loaded one: `audit:contrast` reads stylesheets,
 * `measure:taps` measures hit areas, and neither computes an accessible name,
 * a role, or a heading order.
 *
 * This runs the same rule set and the same serious/critical filter as its
 * signed-out sibling, against the shell, behind a seeded session.
 *
 * Environment: through `node scripts/e2e-workerd.mjs`, like every other
 * authenticated spec.
 */

const EMAIL = 'e2e-a11y-shell@ihype.org';

/* One route per distinct SURFACE, not per URL. The music tabs share a layout
   and differ only in the list they render, so all five would report the same
   nodes; Discover and Playlists are the two whose bodies differ most. */
const SHELL_ROUTES = [
  '/app/map',
  '/app/music/discover',
  '/app/music/playlists',
  '/app/tickets',
  '/app/me',
  '/app/me/settings',
  '/app/me/accessibility',
  '/app/me/profiles',
  '/app/me/payouts',
  '/app/me/events/new',
];

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

async function signIn(context: BrowserContext) {
  const seeded = await applySessionCookie(context, EMAIL);
  // The consent banner overlays the dock and feeds `--mmm-dock-lift`; every
  // other authenticated spec dismisses it for the same reason.
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
  });
  return seeded;
}

/* The shell streams and the map mounts asynchronously, so `networkidle` never
   arrives (analytics and the service worker keep it busy — the sibling spec
   records the same). Wait for the frame, then for a stable URL. */
async function settled(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.mmm-frame:visible')).toBeVisible({ timeout: 15_000 });
  let lastUrl = page.url();
  let stableSince = Date.now();
  const deadline = Date.now() + 6_000;
  while (Date.now() < deadline) {
    const current = page.url();
    if (current !== lastUrl) { lastUrl = current; stableSince = Date.now(); }
    if (Date.now() - stableSince >= 600) break;
    await page.waitForTimeout(120);
  }
}

test.describe('Accessibility — the signed-in shell', () => {
  for (const route of SHELL_ROUTES) {
    test(`${route} has no serious or critical axe violations`, async ({ page, context }) => {
      await signIn(context);
      const response = await page.goto(route);
      expect(response?.status(), `${route} should answer successfully`).toBeLessThan(400);
      await settled(page);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('[data-axe-ignore]')
        .analyze();

      const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (bad.length) {
        const summary = bad
          .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`)
          .join('\n');
        // eslint-disable-next-line no-console -- the assertion diff alone cannot say which node
        console.log(`\nAccessibility violations on ${route}:\n${summary}\n`);
      }
      expect(bad.map((v) => v.id), `${route} should have no serious/critical a11y violations`).toEqual([]);
    });
  }
});
