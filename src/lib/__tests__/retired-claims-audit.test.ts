import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Guards `audit:retired-claims` — the scanner for copy that still sells a
 * capability the product has removed.
 *
 * It is a gate at zero rather than a ratchet, which makes a false positive
 * expensive in a way `audit:untranslated`'s was not: a wrong hit here blocks
 * every merge until somebody writes an exemption for a sentence that was
 * fine. So the properties that matter are that it catches the real thing,
 * that it does not fire on comments, and that both exemption shapes work.
 */

function run(args: string[] = []): { out: string; status: number } {
  try {
    return { out: execFileSync('node', ['scripts/audit-retired-claims.mjs', ...args], { encoding: 'utf8' }), status: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, status: e.status ?? 0 };
  }
}

function probe(body: string, args: string[] = []): { out: string; status: number } {
  /* Written to a scratch directory, never into `src/`: other suites walk that
     tree, and a probe living there even briefly fails them under parallel
     execution. That is measured, not cautious — it broke
     `wiring-guards.test.ts` when `audit:untranslated`'s first test did it. */
  const dir = mkdtempSync(join(tmpdir(), 'retired-claims-probe-'));
  writeFileSync(join(dir, 'Probe.tsx'), body);
  try {
    return run(['--list', `--roots=${dir}`, ...args]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('the retired-claims audit', () => {
  it('is clean on the real tree, and stays a gate at zero', () => {
    const { out, status } = run();
    expect(status, out).toBe(0);
    expect(out).toMatch(/0 claims across \d+ files \(budget 0\)/);
  });

  it('exits 2 rather than reporting a triumphant zero when the roots have moved', () => {
    /* The failure `audit:routes` and `audit:mounts` both had to be taught:
       an empty file list is a broken scanner, not a clean codebase. */
    const { status } = run([`--roots=${join(tmpdir(), 'definitely-not-a-real-root')}`]);
    expect(status).toBe(2);
  });

  it('catches a capability claim that the product cannot honour', () => {
    const { out, status } = probe('export const C = () => <p>Go live with live chat and a listener count.</p>;\n');
    expect(status).toBe(1);
    expect(out).toContain('live chat');
    expect(out, 'the report has to say what is true instead').toContain('There is no go-live');
  });

  it('never fires on a comment, including this scanner documenting itself', () => {
    /* The third time this repository has been bitten by a scanner reading
       its own prose — hence the shared masker. This file's own header names
       every retired phrase. */
    const { status } = probe('// We removed the AI Page Creator and live chat.\n/* No more radio shows either. */\nexport const C = () => <p>Upload a track.</p>;\n');
    expect(status).toBe(0);
  });

  it('honours a line exemption and still requires a reason for it', () => {
    const withReason = probe('export const C = () => (\n  <p>\n    {/* retired-claim-exempt: quoting a retired term in a changelog. */}\n    <span>radio shows</span>\n  </p>\n);\n');
    expect(withReason.status).toBe(0);

    const bare = probe('export const C = () => (\n  <p>\n    {/* retired-claim-exempt */}\n    <span>radio shows</span>\n  </p>\n);\n');
    expect(bare.status, 'a marker with no "why" is not an exemption').toBe(1);
  });

  it('honours a whole-file exemption, which is a separate and louder marker', () => {
    const { status } = probe('/* retired-claim-exempt-file: every line here is a model prompt. */\nexport const A = `radio shows`;\nexport const B = `live chat`;\n');
    expect(status).toBe(0);
  });

  it('leaves the admin console alone wherever the file happens to live', () => {
    /* Same rule as `audit:untranslated`, and for the same reason:
       `AdminAdsClient` sits outside `src/components/admin/`, so a
       directory-only exclusion would put console strings in a member count. */
    const dir = mkdtempSync(join(tmpdir(), 'retired-claims-admin-'));
    writeFileSync(join(dir, 'AdminThing.tsx'), 'export const C = () => <p>live chat</p>;\n');
    /* A second, ordinary file so the directory is not EMPTY after the admin
       one is skipped — an empty file list exits 2 by design, and the first
       version of this test measured that guard instead of the exclusion. */
    writeFileSync(join(dir, 'Ordinary.tsx'), 'export const D = () => <p>Upload a track.</p>;\n');
    try {
      expect(run(['--list', `--roots=${dir}`]).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('every table entry says when and what instead, not just what is banned', () => {
    /* An entry that only forbids a phrase teaches the next reader nothing
       and is the first thing deleted when it becomes inconvenient. */
    const source = execFileSync('cat', ['scripts/audit-retired-claims.mjs'], { encoding: 'utf8' });
    const entries = source.split('pattern:').slice(1);
    expect(entries.length).toBeGreaterThanOrEqual(6);
    for (const entry of entries) {
      const head = entry.slice(0, 600);
      expect(head).toContain('what:');
      expect(head).toContain('retired:');
      expect(head).toContain('instead:');
    }
  });
});
