import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

/**
 * Guards the two decisions that make `audit:untranslated` worth reading.
 *
 * A scanner is only useful while people trust its list. This one reads JSX
 * with a regex, so it will always be one bad heuristic away from reporting
 * `"= 0 && index"` — and the first list that contains something like that is
 * the last one anybody reads carefully. Both properties below were false in
 * the first draft and were found by sampling the output rather than by
 * reasoning about the code.
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
