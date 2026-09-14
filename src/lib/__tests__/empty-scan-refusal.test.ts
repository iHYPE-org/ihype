import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * A gate at zero has to say what it measured, or its pass is indistinguishable
 * from its absence.
 *
 * Four CI gates were run from a cwd holding an empty `src/app` on 2026-09-14
 * (DESIGN_SYNC row 433) and every one of them passed: `audit:css --max=0`
 * printed "No selector is silently overridden" over zero stylesheets,
 * `audit:retro` printed "Coverage: 0/0", `audit:routes --max-legacy=0`
 * inventoried nothing and `audit:spacing --max=900` read "within the
 * baseline". A renamed directory, a broken glob or a wrong cwd would have
 * turned each into a green step that measured nothing. `audit:mounts`,
 * `audit:doc-paths`, `audit:published-urls`, `audit:unstyled` and
 * `audit:untranslated` already refused an empty collection with exit 2; this
 * pins the same rule on the four that did not.
 *
 * The probe lives in `tmpdir`, never under `src/` — `wiring-guards.test.ts`
 * walks that tree (row 390).
 */

const GATES: Array<{ script: string; args: string[]; refusal: RegExp }> = [
  { script: 'scripts/audit-css.mjs', args: ['--max=0'], refusal: /read 0 stylesheet/ },
  { script: 'scripts/audit-retro-coverage.mjs', args: ['--max=0'], refusal: /collected 0 page/ },
  { script: 'scripts/audit-routes.mjs', args: ['--max-legacy=0'], refusal: /collected 0 page/ },
  { script: 'scripts/audit-spacing.mjs', args: ['--max=900'], refusal: /read 0 file/ },
];

describe('a ratchet or gate that read nothing refuses to report a pass', () => {
  for (const gate of GATES) {
    it(`${gate.script} exits 2 over an empty source tree`, () => {
      const cwd = mkdtempSync(join(tmpdir(), 'ihype-empty-scan-'));
      try {
        mkdirSync(join(cwd, 'src', 'app'), { recursive: true });
        const result = spawnSync('node', [resolve(gate.script), ...gate.args], {
          cwd,
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
        });
        expect(result.status, `${gate.script} did not refuse:\n${result.stdout}\n${result.stderr}`).toBe(2);
        expect(result.stderr).toMatch(gate.refusal);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    });
  }
});
