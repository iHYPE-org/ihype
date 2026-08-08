import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';

/**
 * Automated accessibility coverage for the SIGNED-IN app shell.
 *
 * `e2e/accessibility.spec.ts` only audits public pages (`/login`, `/register`,
 * `/discover`, one show page), so until this file existed not a single
 * authenticated route had ever been through axe — including the whole app
 * shell, on a design whose README leads on keyboard and AT affordances. The
 * gap was invisible because the existing suite was green.
 *
 * Same scope as that spec — serious/critical only — so the two agree on what
 * counts as a failure, and the drawer is audited in its open state because
 * that is the state that actually covers the page.
 *
 * Run against BOTH themes. The design ships light and dark "from one token
 * set", which means one set of contrast bugs per theme, not one overall — and
 * headless Chromium reports `prefers-color-scheme: light`, so a suite that
 * just loads the page silently audits only the non-canonical theme. The first
 * run of this file did exactly that, and every failure it found was a light
 * value.
 */

const SHELL_ROUTES = [
  '/shows?tab=local',
  '/me/dashboard',
  '/pages?tab=creator',
  '/settings/accessibility',
];

const THEMES = ['dark', 'light'] as const;

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

/**
 * The app reads its theme from localStorage on boot (see the inline bootstrap
 * in the root layout), so setting it there before any navigation is what makes
 * the choice deterministic rather than inherited from the OS.
 */
async function useTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try { window.localStorage.setItem('theme', value); } catch { /* storage disabled */ }
  }, theme);
}

async function assertNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  // Report what actually failed and by how much, not just a count. A bare
  // "expected []" sends the reader to a JSON artifact to learn anything, and
  // for contrast the measured-vs-required ratio IS the fix instruction.
  const summary = seriousOrCritical.flatMap((violation) =>
    violation.nodes.slice(0, 6).map((node) => {
      const data = (node.any[0]?.data ?? {}) as {
        contrastRatio?: number;
        expectedContrastRatio?: string;
        fgColor?: string;
        bgColor?: string;
      };
      return {
        id: violation.id,
        impact: violation.impact,
        target: node.target.join(' '),
        ...(data.contrastRatio
          ? { measured: `${data.contrastRatio}:1`, required: data.expectedContrastRatio, fg: data.fgColor, bg: data.bgColor }
          : {}),
      };
    }),
  );

  expect(summary, `${label} should have no serious/critical a11y violations`).toEqual([]);
}

test.describe('App shell accessibility (serious/critical only)', () => {
  test.beforeEach(async ({ context }) => {
    await seedSessionCookie('e2e-a11y@ihype.org', {
      profiles: [{ type: 'ARTIST', name: 'E2E Artist' }],
    }).then(({ cookie }) => context.addCookies([{
      name: sessionCookieName(),
      value: cookie,
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
      path: '/',
      secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
    }]));
  });

  for (const theme of THEMES) {
    for (const route of SHELL_ROUTES) {
      test(`${theme}: ${route} has no serious or critical axe violations`, async ({ page }) => {
        await useTheme(page, theme);
        await page.goto(route);
        await expect(page.locator('.shell-content')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await assertNoSeriousViolations(page, `${theme} ${route}`);
      });
    }

    test(`${theme}: the open drawer has no serious or critical axe violations`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto('/shows?tab=local');
      await expect(page.locator('.shell-content')).toBeVisible({ timeout: 20000 });
      await page.locator('.shell-logo-tile').click();
      await expect(page.locator('.shell-drawer')).toBeVisible();
      await assertNoSeriousViolations(page, `${theme} drawer open`);
    });
  }
});
