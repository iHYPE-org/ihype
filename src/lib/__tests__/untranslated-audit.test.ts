import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Guards the decisions that make `audit:untranslated` worth reading.
 *
 * A scanner is only useful while people trust its list. This one reads JSX
 * with a regex, so it will always be one bad heuristic away from reporting
 * `"= 0 && index"` — and the first list that contains something like that is
 * the last one anybody reads carefully. Both properties below were false in
 * the first draft and were found by sampling the output rather than by
 * reasoning about the code — as were the two type-annotation cases below.
 */

function run(args: string[] = []): string {
  return execFileSync('node', ['scripts/audit-untranslated.mjs', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

describe('the untranslated-string audit reports prose, not source', () => {
  const listing = run(['--list']);

  it('never reports a comparison or a ternary as member-facing text', () => {
    /* `index >= 0 && index < queue.length` and `state === 'fail' ? …` both
       open with a `>` and close on the next `<`, so a bracket-only regex reads
       the middle as JSX text. */
    const codeShaped = listing
      .split('\n')
      .filter((line) => /\bTEXT\b/.test(line))
      .filter((line) => /"[^"]*(&&|\|\||===|!==|=>)/.test(line) || /"\s*[=:?]/.test(line));
    expect(codeShaped, 'the audit is reporting source as prose').toEqual([]);
  });

  it('leaves the admin console alone wherever the file happens to live', () => {
    /* The console ships in English by decision — every `admin*` namespace is
       deliberately untranslated — and it is roughly three times the size of
       the member-facing surface, so counting it would bury the strings that
       matter. `AdminAdsClient` sits outside `src/components/admin/`, which is
       why the exclusion is by name as well as by directory. */
    expect(listing).not.toMatch(/src\/components\/admin\//);
    expect(listing).not.toMatch(/src\/components\/Admin[A-Z]/);
  });

  it('never reports a TypeScript generic as member-facing text', () => {
    /* `() => Promise<void>` reads as ">Promise<": the arrow supplies the
       opening `>` and the generic the closing `<`. The word "Promise" was in
       the list three times, with "void; selected: ReadonlySet" and
       "r._count._all" beside it. `CODE_FRAGMENT` cannot catch these — it
       inspects the captured text, and these captures are innocent words — so
       the test is on the character BEFORE the match. */
    for (const word of ['"Promise"', '"void; selected', '"r._count']) {
      expect(listing, `${word} is a type annotation, not prose`).not.toContain(word);
    }
  });

  it('still reports the text inside a bare fragment', () => {
    /* The guard above rejects a capture whose `>` came from an operator, and
       the obvious over-broad version of it — any of `=!<->` — would suppress
       every `<>fragment</>` in the codebase silently, reporting a triumphant
       drop. Only `=` produces this, because `>=` puts the `=` inside the
       capture where CODE_FRAGMENT already sees it. */
    /* Scanned through `--roots=` rather than by dropping a file into `src/`:
       other suites walk that tree, and a probe living there even briefly
       fails them when vitest runs files in parallel. That is not a guess —
       it broke `wiring-guards.test.ts` on the first attempt. */
    const dir = mkdtempSync(join(tmpdir(), 'untranslated-probe-'));
    writeFileSync(join(dir, 'Probe.tsx'), 'export function Probe() {\n  return <>Save your ticket</>;\n}\n');
    try {
      expect(run(['--list', `--roots=${dir}`])).toContain('Save your ticket');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never reports a bare domain, which is a brand constant', () => {
    /* `ihype.org` is the only domain this product may name. Flagging it as a
       string to translate invites exactly the change CLAUDE.md forbids. */
    expect(listing).not.toMatch(/TEXT\s+"ihype\.org"/);
  });

  it('fails when the count exceeds the budget, so the ratchet can bite', () => {
    let exitCode = 0;
    try {
      run(['--max=0']);
    } catch (error) {
      exitCode = (error as { status?: number }).status ?? 0;
    }
    expect(exitCode, 'a budget of 0 must fail while any hardcoded string remains').toBe(1);
  });
});
