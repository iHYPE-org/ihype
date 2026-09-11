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

  describe('i18n-exempt marks a string as deliberately English', () => {
    /* Some strings must NOT be translated and translating them would be the
       bug — a basemap attribution naming two organisations, a honeypot label
       no person ever reads, operator-only chrome. Without a marker the
       ratchet can never reach zero, and a floor nobody can clear is a floor
       people stop lowering.

       Every case below is a bug this took on the way in. Scanning UPWARD
       from the string was wrong twice (a one-line lookback misses a two-line
       reason; a "contiguous comment" walk misses it too, because only the
       first line of a JSX comment block starts with a comment token), so the
       rule scans FORWARD from the marker to the end of its comment and
       exempts the next line carrying anything. */
    function measure(body: string): string {
      const dir = mkdtempSync(join(tmpdir(), 'untranslated-exempt-'));
      writeFileSync(join(dir, 'Probe.tsx'), body);
      try {
        return run(['--list', `--roots=${dir}`]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    it('exempts the line after a one-line reason', () => {
      expect(measure('export function P() {\n  // i18n-exempt: a brand name.\n  return <p>Save your ticket</p>;\n}\n'))
        .not.toContain('Save your ticket');
    });

    it('exempts the line after a reason that runs over two lines', () => {
      expect(measure('export function P() {\n  // i18n-exempt: a licence condition, and the reason\n  // is long enough that it does not fit on one line.\n  return <p>Save your ticket</p>;\n}\n'))
        .not.toContain('Save your ticket');
    });

    it('exempts the line after a JSX comment block', () => {
      expect(measure('export function P() {\n  return (\n    <div>\n      {/* i18n-exempt: operator chrome, and this reason\n          continues onto a second line. */}\n      <p>Save your ticket</p>\n    </div>\n  );\n}\n'))
        .not.toContain('Save your ticket');
    });

    it('ignores a marker with no reason', () => {
      /* "Exempt" with no "why" is indistinguishable from a string somebody
         could not be bothered to wrap, so the reason is required. */
      expect(measure('export function P() {\n  // i18n-exempt\n  return <p>Save your ticket</p>;\n}\n'))
        .toContain('Save your ticket');
    });
  });

  it('fails when the count exceeds the budget, so the ratchet can bite', () => {
    /* This used to run `--max=0` against the REAL tree and expect a failure,
       which was true only while debt remained. The debt reached zero on
       2026-09-11 and the assertion inverted — a test whose premise expires
       is worse than no test, because it fails on the day the work succeeds.
       It measures the MECHANISM now: one hardcoded string in a scratch
       directory, budget zero, exit 1. That stays true at any count. */
    const dir = mkdtempSync(join(tmpdir(), 'untranslated-ratchet-'));
    writeFileSync(join(dir, 'Probe.tsx'), 'export const P = () => <p>Save your ticket</p>;\n');
    let exitCode = 0;
    try {
      run([`--roots=${dir}`, '--max=0']);
    } catch (error) {
      exitCode = (error as { status?: number }).status ?? 0;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(exitCode, 'a budget of 0 must fail on a hardcoded string').toBe(1);
  });

  it('is a GATE now, not a ratchet — the real tree passes at zero', () => {
    /* And the thing that number does NOT mean, said here because it is the
       sentence most likely to be over-read: the four legal documents are
       still English. Their binding text lives in string constants, which this
       audit structurally cannot see — it reads JSX text. Zero means no
       hardcoded JSX string remains, never that the terms are translated. */
    expect(() => run(['--max=0'])).not.toThrow();
  });
});
