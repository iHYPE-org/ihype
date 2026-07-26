import { test, expect, type Page, type Response } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated a11y baseline — there was previously zero signal on this axis
// anywhere in the repo (no axe/aria/a11y tooling at all).
//
// This spec is only actually exercised via scripts/e2e-workerd.mjs (a real
// Workerd runtime with a real Postgres connection, gated behind
// vars.E2E_ENABLED) — it is NOT part of the mandatory "public browser
// smoke" CI step, which only runs public-smoke.spec.ts against `next dev`
// (see the wasm-engine limitation documented at the top of e2e/auth.spec.ts
// and in src/lib/db.ts). That means DB-backed pages are safe to include
// here, unlike in public-smoke.spec.ts.
//
// /shows/[slug] uses a slug seeded by prisma/launch-seed.ts
// (signal-yard-launch-night) — the test skips gracefully if that show
// doesn't exist rather than failing, since seed data isn't guaranteed in
// every environment this could run in.
//
// Scoped to serious/critical impact only: axe's "moderate"/"minor" rules
// include a lot of subjective or false-positive-prone checks (color
// contrast on decorative elements, redundant landmark heuristics) that are
// better handled in manual design review than as a hard CI gate. Serious
// and critical violations (missing form labels, non-interactive elements
// with click handlers but no role/keyboard access, broken heading order,
// insufficient contrast on real body text) are unambiguous defects worth
// blocking on.

const STATIC_PAGES = ['/', '/login', '/register', '/discover'];
const SEEDED_SHOW_SLUG = 'signal-yard-launch-night';

async function assertNoSeriousViolations(page: Page, path: string, response: Response | null) {
  expect(response?.status(), `${path} should return a successful response`).toBeLessThan(400);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('[data-axe-ignore]')
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  if (seriousOrCritical.length) {
    const summary = seriousOrCritical
      .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})\n  ${v.helpUrl}`)
      .join('\n');
    // eslint-disable-next-line no-console -- surface details in CI logs, not just the assertion diff
    console.log(`Accessibility violations on ${path}:\n${summary}`);
  }

  expect(seriousOrCritical, `${path} should have no serious/critical a11y violations`).toEqual([]);
}

test.describe('Accessibility (serious/critical only)', () => {
  for (const path of STATIC_PAGES) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      const response = await page.goto(path);
      await assertNoSeriousViolations(page, path, response);
    });
  }

  test(`/shows/${SEEDED_SHOW_SLUG} has no serious or critical axe violations`, async ({ page }) => {
    const response = await page.goto(`/shows/${SEEDED_SHOW_SLUG}`);
    if (response?.status() === 404) {
      test.skip(true, `Seeded show "${SEEDED_SHOW_SLUG}" not found — run prisma/launch-seed.ts first`);
      return;
    }
    await assertNoSeriousViolations(page, `/shows/${SEEDED_SHOW_SLUG}`, response);
  });
});
