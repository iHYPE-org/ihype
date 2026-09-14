/**
 * Reads a Playwright JSON report and names the tests that SKIPPED for a
 * reason the harness itself should have made impossible.
 *
 * Nearly every authenticated spec opens with
 * `test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET …')`,
 * and `canSeedSession()` is a plain check of two environment variables that
 * `scripts/e2e-workerd.mjs` supplies to the Playwright child it spawns. So a
 * skip carrying that reason INSIDE the harness is never a legitimate skip: it
 * is a renamed variable, a broken fixture or a changed predicate, and
 * Playwright exits 0 over it. Until 2026-09-14 the harness forwarded that 0
 * and CI's mandatory authenticated step read green over a suite that had
 * asserted nothing — the same shape as a walk item printing a count it never
 * measured (DESIGN_SYNC row 427), one level up.
 *
 * Data-shaped skips ("the default station has no playable track", "seeded
 * show not found") are reported, not refused: they say something about the
 * fixture rather than the harness, and refusing them here would be a second
 * opinion on what the spec already decided.
 */
export const ENV_SHAPED_SKIP = /AUTH_SECRET|DATABASE_URL|seed a session|seeded database/i;

/** Every skipped test in the report, with the skip reason its annotations carry. */
export function collectSkips(report) {
  const out = [];
  const walk = (suite, file) => {
    const here = suite.file ?? file ?? '';
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const skipped = results.length
          ? results.every((r) => r.status === 'skipped')
          : test.status === 'skipped';
        if (!skipped) continue;
        const reason = (test.annotations ?? [])
          .filter((a) => a.type === 'skip' || a.type === 'fixme')
          .map((a) => a.description ?? '')
          .filter(Boolean)
          .join(' ');
        out.push({ file: here, title: spec.title, reason });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report?.suites ?? []) walk(suite, suite.file);
  return out;
}

/** The subset of skips whose reason names the environment the harness supplies. */
export function envShapedSkips(report) {
  return collectSkips(report).filter((skip) => ENV_SHAPED_SKIP.test(skip.reason));
}
