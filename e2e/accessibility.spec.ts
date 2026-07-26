import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated a11y baseline — there was previously zero signal on this axis
// anywhere in the repo (no axe/aria/a11y tooling at all). This only scans
// pages that render without auth or seeded data, matching the same
// public/no-DB-dependency scope as public-smoke.spec.ts, so it can run
// alongside that mandatory suite rather than needing the gated "Extended
// authenticated E2E suite" secrets.
//
// Scoped to serious/critical impact only: axe's "moderate"/"minor" rules
// include a lot of subjective or false-positive-prone checks (color
// contrast on decorative elements, redundant landmark heuristics) that are
// better handled in manual design review than as a hard CI gate. Serious
// and critical violations (missing form labels, non-interactive elements
// with click handlers but no role/keyboard access, broken heading order,
// insufficient contrast on real body text) are unambiguous defects worth
// blocking on.

const PUBLIC_PAGES = ['/', '/login'];

test.describe('Accessibility (serious/critical only)', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      const response = await page.goto(path);
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
    });
  }
});
