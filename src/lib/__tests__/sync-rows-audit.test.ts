import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * `audit:sync-rows` refuses two DESIGN_SYNC rows sharing a number, because the
 * number is the ADDRESS CLAUDE.md cites and a duplicate silently sends the
 * next reader to the wrong row.
 *
 * Verified in BOTH directions here, which is the whole of the gate's value: a
 * refusal nobody has watched fire is a refusal nobody can trust. The probe
 * lives in `tmpdir`, never under `src/` — `wiring-guards.test.ts` walks that
 * tree (DESIGN_SYNC row 390).
 */

const SCRIPT = resolve('scripts/audit-sync-rows.mjs');

function run(doc: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'ihype-sync-rows-'));
  try {
    writeFileSync(join(cwd, 'DESIGN_SYNC.md'), doc);
    return spawnSync('node', [SCRIPT, '--max=0'], { cwd, encoding: 'utf8' });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const row = (n: number, body: string) => `| ${n} | \`src/probe.ts\` | ${body} |`;
const clean = [row(100, 'first'), row(101, 'second'), row(103, 'third')].join('\n');

describe('audit:sync-rows', () => {
  it('passes over rows whose numbers are all distinct', () => {
    const r = run(clean);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/No row number is used twice/);
  });

  it('names the next free number on a clean run, which is what stops the next collision', () => {
    // The preventive half. An author appending a row must not have to derive
    // this from a file that is not in numeric order.
    const r = run(clean);
    expect(r.stdout).toMatch(/Next free row number: 104/);
    expect(r.stdout).toMatch(/unused gaps: 102/);
  });

  it('fails on a duplicate and names every row that shares the number', () => {
    const r = run([clean, row(101, 'a colliding row')].join('\n'));
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/101 — 2 rows/);
    // Both sides are printed with their line, so the reader can tell which is
    // which without opening the file.
    expect(r.stdout).toMatch(/line 2:/);
    expect(r.stdout).toMatch(/line 4:/);
    expect(r.stdout).toMatch(/second/);
    expect(r.stdout).toMatch(/a colliding row/);
  });

  it('offers free numbers to move the duplicate into', () => {
    const r = run([clean, row(101, 'a colliding row')].join('\n'));
    expect(r.stdout).toMatch(/Free numbers: 102, 104/);
  });

  it('reads LINE-INITIAL markers only, so a row quoting one in its own prose is data', () => {
    // The scanner-reads-its-own-documentation trap, recorded four times in this
    // repository (`scripts/lib/mask-comments.mjs` exists for it). This very
    // change's DESIGN_SYNC row quotes row markers while explaining the gate.
    const quoting = row(104, 'renumbered it because `| 101 |` was taken, see `| 103 |`');
    const r = run([clean, quoting].join('\n'));
    expect(r.status, r.stdout).toBe(0);
    expect(r.stdout).toMatch(/4 row\(s\)/);
  });

  it('refuses a file with no rows rather than reporting a pass', () => {
    const r = run('# DESIGN_SYNC\n\nprose only, no rows\n');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/read 0 row\(s\)/);
  });
});
