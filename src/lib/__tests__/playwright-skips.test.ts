import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM script module, no declaration file by design
import { collectSkips, envShapedSkips, ENV_SHAPED_SKIP } from '../../../scripts/lib/playwright-skips.mjs';

/* A Playwright JSON report, cut down to the fields the collector reads: the
   shape `--reporter=json` writes (suites → specs → tests → results, with skip
   annotations on the test). Built by hand rather than recorded, so the case
   the harness exists to refuse — an env-shaped skip inside a run — can be
   produced without breaking a real fixture. */
function report(specs: Array<{ file: string; title: string; status: 'passed' | 'skipped'; reason?: string }>) {
  const byFile = new Map<string, typeof specs>();
  for (const spec of specs) byFile.set(spec.file, [...(byFile.get(spec.file) ?? []), spec]);
  return {
    suites: [...byFile.entries()].map(([file, list]) => ({
      title: file,
      file,
      specs: list.map((spec) => ({
        title: spec.title,
        tests: [{
          status: spec.status === 'skipped' ? 'skipped' : 'expected',
          annotations: spec.reason ? [{ type: 'skip', description: spec.reason }] : [],
          results: [{ status: spec.status }],
        }],
      })),
      suites: [],
    })),
  };
}

describe('playwright-skips', () => {
  it('names every skipped test with the reason its annotation carries', () => {
    const skips = collectSkips(report([
      { file: 'e2e/a.spec.ts', title: 'passes', status: 'passed' },
      { file: 'e2e/a.spec.ts', title: 'skips for data', status: 'skipped', reason: 'the default station has no playable track' },
      { file: 'e2e/b.spec.ts', title: 'skips for env', status: 'skipped', reason: 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.' },
    ]));
    expect(skips.map((s: { title: string }) => s.title)).toEqual(['skips for data', 'skips for env']);
    expect(skips[1].file).toBe('e2e/b.spec.ts');
  });

  it('refuses only the skips whose reason names the environment the harness supplies', () => {
    const env = envShapedSkips(report([
      { file: 'e2e/a.spec.ts', title: 'data', status: 'skipped', reason: 'Seeded show "x" not found — run prisma/launch-seed.ts first' },
      { file: 'e2e/b.spec.ts', title: 'env', status: 'skipped', reason: 'AUTH_SECRET and a scratch DATABASE_URL are required.' },
      { file: 'e2e/c.spec.ts', title: 'env too', status: 'skipped', reason: 'needs a seeded database and AUTH_SECRET' },
    ]));
    expect(env.map((s: { title: string }) => s.title)).toEqual(['env', 'env too']);
  });

  it('matches every env-shaped skip reason the specs actually write', () => {
    /* The regex is the contract between the specs and the harness; a reason
       reworded off it would skip silently again. Every distinct wording in
       e2e/*.spec.ts that gates on canSeedSession() is listed here. */
    for (const reason of [
      'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.',
      'AUTH_SECRET and a scratch DATABASE_URL are required.',
      'needs a seeded database and AUTH_SECRET',
    ]) {
      expect(ENV_SHAPED_SKIP.test(reason), reason).toBe(true);
    }
    expect(ENV_SHAPED_SKIP.test('the default station has no playable track — nothing to start')).toBe(false);
  });

  it('reads an empty or malformed report as no skips, never as a failure of its own', () => {
    expect(collectSkips({})).toEqual([]);
    expect(collectSkips({ suites: [] })).toEqual([]);
    expect(envShapedSkips(undefined)).toEqual([]);
  });
});
