import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The traps in `audit:doc-paths`, pinned.
 *
 * This scanner reads prose and decides whether the prose excuses itself,
 * which is the shape that has misfired four times in this repository — the
 * reason `mask-comments.mjs` and `exempt-lines.mjs` exist. Both of its own
 * near-misses were found by driving it rather than by reading it, so both are
 * held here.
 */
const run = (cwd: string) => {
  try {
    return { code: 0, out: execFileSync('node', [join(process.cwd(), 'scripts/audit-doc-paths.mjs')], { cwd, encoding: 'utf8' }) };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

/** A document with `filler` rows that all resolve, plus whatever is added. */
function docWith(extraRows: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'doc-paths-'));
  const real = 'src/lib/permissions.ts';
  const filler = Array.from({ length: 120 }, (_, i) => `| \`${real}\` | filler row ${i} |`);
  writeFileSync(join(dir, 'CLAUDE.md'), [...filler, ...extraRows].join('\n'));
  // The scanner resolves paths relative to its cwd, so the scratch tree needs
  // the one file the filler names.
  execFileSync('mkdir', ['-p', join(dir, 'src/lib')]);
  copyFileSync(real, join(dir, real));
  return dir;
}

describe('audit:doc-paths', () => {
  it('fails on a path named by a row that does not say the file is gone', () => {
    const { code, out } = run(docWith(['| `src/lib/not-a-real-file.ts` | the live wiring |']));
    expect(code).toBe(1);
    expect(out).toContain('src/lib/not-a-real-file.ts');
  });

  it('passes when the row says the file is gone', () => {
    const { code } = run(docWith(['| `src/lib/not-a-real-file.ts` | **Deleted 2026-01-01.** It lived here once. |']));
    expect(code).toBe(0);
  });

  it('does not let a FILENAME satisfy the "is it gone" vocabulary', () => {
    /* Measured: a probe path called `permissions-GONE.ts` exempted its own
       row, because the test ran over the raw row including the paths. The
       scanner read its own data as its own instruction — so the paths are
       masked out before the prose is judged, and this is what holds that. */
    const { code, out } = run(docWith(['| `src/lib/deleted-thing-removed.ts` | the live wiring |']));
    expect(code, out).toBe(1);
    expect(out).toContain('src/lib/deleted-thing-removed.ts');
  });

  it('reads PROSE, not only table rows — where all three never-existed paths were', () => {
    /* Until 2026-09-15 the unit of judgement was `| … |` alone, so the sync
       workflow's "run `scripts/export-tokens.js`", the API-client note's
       "`lib/api.js` — use this as the API route reference" and the navigation
       note's "copy `lib/NavShell.js`" were all unscanned. None of the four has
       ever existed in any commit on any branch. A numbered instruction naming
       a file is a stronger claim than a table row, not a weaker one. */
    const { code, out } = run(docWith(['', '4. Run `node scripts/not-a-real-script.mjs` when tokens change', '']));
    expect(code, out).toBe(1);
    expect(out).toContain('scripts/not-a-real-script.mjs');
    expect(out).toContain('in the prose at line');
  });

  it('judges a prose BLOCK, so a "this is gone" line one line away still excuses it', () => {
    /* The block rather than the line, for the reason `exempt-lines.mjs`
       exists: a reason routinely sits a line away from what it excuses. */
    const { code, out } = run(docWith([
      '',
      'The old token exporter lived at `scripts/not-a-real-script.mjs`.',
      'It was deleted in the console conversion; tokens are read from globals.css now.',
      '',
    ]));
    expect(code, out).toBe(0);
  });

  it('looks outside src/ — a path there is just as much an instruction', () => {
    const { code, out } = run(docWith(['| `lib/not-a-real-api.js` | the API route reference |']));
    expect(code, out).toBe(1);
    expect(out).toContain('lib/not-a-real-api.js');
  });

  it('does not match a prefix inside a longer word', () => {
    /* Unanchored, `lib` matches inside `mylib/api.js` and `public` inside
       `republic/x.ts`. A scanner wrong about its own inputs invents findings,
       and an invented finding is worse than a missed one — the first list
       containing one is the last anyone reads carefully. */
    const { code, out } = run(docWith(['| `mylib/api.js` and `republic/nope.ts` | the live wiring |']));
    expect(code, out).toBe(0);
  });

  it('refuses a suspiciously empty scan rather than reporting a pass', () => {
    /* A zero has to be earned. If the document stops being a table, or the
       path shape changes, finding nothing to check must not read as finding
       nothing wrong — the failure `audit:mounts` refuses by exiting on an
       empty collection. */
    const dir = mkdtempSync(join(tmpdir(), 'doc-paths-empty-'));
    writeFileSync(join(dir, 'CLAUDE.md'), '# no table rows here at all\n');
    const { code, out } = run(dir);
    expect(code).toBe(2);
    expect(out).toContain('implausibly low');
  });

  it('is wired into CI, because an audit nobody runs is not a gate', () => {
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('npm run audit:doc-paths');
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts['audit:doc-paths']).toBeTruthy();
  });
});
