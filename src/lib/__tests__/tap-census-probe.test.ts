import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The tap-target census probe's own preconditions.
 *
 * `measure:taps` counts controls rendered smaller than 44x44 across the
 * signed-in shell — the instrument CLAUDE.md's visual-audit row names as the
 * one this repository still lacks, because `audit:mobile` measures the
 * signed-out pages and the 44px floors live almost entirely inside the shell.
 * It cannot run here: it needs a built worker, a database and Chromium. What
 * CAN run on every push is a guard on the two ways its probe silently breaks.
 *
 * THE FIRST IS AN ESCAPE. The probe is a TEMPLATE LITERAL, so JavaScript
 * resolves every escape before the browser sees the source. `/inset\(\s*50%/`
 * arrives as `/inset(s*50%/`, which is a syntax error and was caught in one
 * run. `/\s+/` arrives as `/s+/`, which is NOT an error — it splits class
 * names on the letter s and would have produced a plausible census forever.
 * `'\n'` inside a string arrives as a real newline and terminates it. So the
 * probe is written with no backslashes at all, and this asserts that, because
 * the natural edit is to add one back.
 *
 * THE SECOND IS A SILENT ZERO. A census whose selector stopped matching
 * reports zero controls under the floor, which reads as a perfect score. The
 * probe counts every control it CONSIDERED and the script refuses to report at
 * all when that figure is implausibly low, so the guard here is that both
 * halves are still present.
 */
const source = readFileSync('scripts/measure-layout.mts', 'utf8');

function tapProbe(): string {
  const start = source.indexOf('const TAP_PROBE = `');
  expect(start, 'TAP_PROBE was renamed or removed').toBeGreaterThan(-1);
  const body = source.slice(start + 'const TAP_PROBE = `'.length);
  const end = body.indexOf('`;');
  expect(end, 'TAP_PROBE is no longer a template literal').toBeGreaterThan(-1);
  return body.slice(0, end);
}

describe('the census probe survives being a template literal', () => {
  it('contains no backslash at all', () => {
    const probe = tapProbe();
    const offenders = probe
      .split('\n')
      .map((line, index) => ({ line, index: index + 1 }))
      .filter((entry) => entry.line.includes('\\'));
    expect(
      offenders.map((entry) => `line ${entry.index}: ${entry.line.trim()}`),
      'a backslash here is resolved by the template literal before the browser sees it',
    ).toEqual([]);
  });

  it('builds its whitespace characters from char codes instead', () => {
    expect(tapProbe()).toContain('String.fromCharCode');
  });

  it('has no regular expression literal to put an escape back into', () => {
    /* Not a style rule: every regex the probe needs carries \\s or \\(, and the
       moment one is written naturally the probe breaks in one of the two ways
       above. The helpers are split/join instead. */
    expect(tapProbe()).not.toMatch(/=\s*\/[^/\n]+\/[gimsuy]*[.;)]/);
  });
});

describe('the census cannot report a silent zero', () => {
  it('counts every control it considered, not only the failures', () => {
    expect(tapProbe()).toContain('controlCount += 1');
    expect(source).toContain('controlsConsidered +=');
  });

  it('refuses to print a score when it considered implausibly few', () => {
    expect(source).toMatch(/controlsConsidered < \d+/);
    expect(source).toContain('Refusing to report a score');
  });

  it('reports the tightest control that clears the floor', () => {
    expect(source).toContain('Tightest control that CLEARS the floor');
  });
});

describe('the census measures what MOBILE.md calls a control', () => {
  it('keeps the floor at 44', () => {
    expect(tapProbe()).toMatch(/const FLOOR = 44;/);
  });

  it('measures a checkbox by its label, which is what a finger hits', () => {
    expect(tapProbe()).toContain('labelFor');
    expect(tapProbe()).toContain("via = 'label'");
  });

  it('counts a link inside a sentence separately rather than as a defect', () => {
    expect(tapProbe()).toContain('prose');
    expect(source).toContain('inline link(s) in running copy');
  });

  it('excludes only what is parked far off-screen, never what merely scrolled out', () => {
    /* The section strip and the shelves scroll sideways: their later items sit
       beyond the right edge and are perfectly reachable. Excluding those would
       hide real defects on the rows carrying the most controls. */
    expect(tapProbe()).toContain('r.right <= -1000');
    expect(tapProbe()).not.toContain('r.right <= 0');
  });
});
