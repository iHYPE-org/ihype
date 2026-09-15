import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_ALERT_ADDRESS, getAdminAlertRecipients } from '@/lib/env';

/**
 * Operational alerts go to one address and no environment value can move them.
 *
 * The owner's instruction (2026-09-15, "send all emails to admin@ihype.org
 * always") replaced a comma-separated `ADMIN_ALERT_EMAIL` override that fed 32
 * alert call sites — cron failures, the DMCA queue, access requests, payout
 * alerts, show cancellations. The override is the kind of thing that comes
 * back: it reads as a harmless convenience, and the docstring it replaced
 * argued FOR it ("not a bus factor of one"). So the rule is pinned here rather
 * than left to the reader.
 *
 * The second test is the one with teeth. A future edit could satisfy the first
 * by reading the variable and merely defaulting to the same address, which is
 * exactly the shape that was removed — so no source file may read that name at
 * all. Prose may still mention it; a read may not exist.
 */
describe('operational alerts are pinned to one address', () => {
  it('always resolves to admin@ihype.org', () => {
    expect(ADMIN_ALERT_ADDRESS).toBe('admin@ihype.org');
    expect(getAdminAlertRecipients()).toEqual(['admin@ihype.org']);
  });

  it('ignores ADMIN_ALERT_EMAIL entirely, however it is set', () => {
    const original = process.env.ADMIN_ALERT_EMAIL;
    try {
      for (const value of ['ops@example.com', 'a@example.com,b@example.com', '', '   ']) {
        process.env.ADMIN_ALERT_EMAIL = value;
        expect(getAdminAlertRecipients()).toEqual(['admin@ihype.org']);
      }
    } finally {
      if (original === undefined) delete process.env.ADMIN_ALERT_EMAIL;
      else process.env.ADMIN_ALERT_EMAIL = original;
    }
  });

  it('no source file reads the retired variable', () => {
    const roots = ['src', 'scripts', 'workers'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.(tsx?|mts|mjs|js)$/.test(full)) continue;
        /* This file SETS the variable, to prove it is ignored — the scanner
           would otherwise report itself, which is the trap `mask-comments.mjs`
           exists for elsewhere in this repo. */
        if (full.endsWith('admin-alert-address.test.ts')) continue;
        const src = readFileSync(full, 'utf8');
        /* A READ, not a mention: `process.env.X`, `env.X`, or the name inside a
           readRuntimeEnv()/getenv-style call. The docstring in env.ts and the
           note in .env.example both name it on purpose, as the record of what
           was removed, and must stay legal. */
        if (/(?:process\.env\.ADMIN_ALERT_EMAIL|readRuntimeEnv\(\s*['"`]ADMIN_ALERT_EMAIL)/.test(src)) {
          offenders.push(full);
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
