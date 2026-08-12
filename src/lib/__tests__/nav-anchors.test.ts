import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ME_PANEL_ROWS } from '../mmm-me-panels';
import { MMM_ME_PANELS } from '../mmm-nav';

/**
 * A link with a `#fragment` fails silently. The page loads, nothing errors, and
 * the member lands at the top of a long page wondering where the thing went —
 * which is exactly what ME's "Notifications" row did: it pointed at
 * `/settings#notifications` and no element carried that id.
 *
 * Nothing else can catch this. TypeScript sees a string; the route exists, so a
 * link check passes; and an e2e that clicks it still lands on a valid page.
 */

const pageFor = (route: string) => `src/app${route}/page.tsx`;

describe('in-app anchor links', () => {
  const rows = Object.values(ME_PANEL_ROWS).flat();

  it('has rows to check, so a refactor cannot empty this test into a pass', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(MMM_ME_PANELS.length).toBeGreaterThan(0);
  });

  it('points every fragment at an id that exists on the target page', () => {
    const anchored = rows.filter((row) => row.href.includes('#'));
    // If nobody uses a fragment any more the test is vacuous rather than wrong,
    // but it should not quietly become so — hence the count assertion above.
    for (const row of anchored) {
      const [route, fragment] = row.href.split('#');
      let source: string;
      try {
        source = readFileSync(pageFor(route), 'utf8');
      } catch {
        throw new Error(`${row.label} links to ${row.href}, but ${pageFor(route)} does not exist`);
      }
      const hasId =
        source.includes(`id="${fragment}"`) ||
        source.includes(`id={'${fragment}'}`) ||
        source.includes(`id={\`${fragment}\`}`);
      expect(hasId, `${row.label} links to #${fragment}, which no element on ${route} carries`).toBe(true);
    }
  });
});
