import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config.mjs';

/**
 * `audit:mobile` runs after every production deploy under `--strict`, and it
 * measures each page signed out. A page that redirects measures a different
 * page, and one that redirects from INSIDE the page (a `redirect()` under the
 * root loading boundary answers a 200 carrying a one-second meta refresh)
 * races the script's settle and fails the step at random: deploy run 1014,
 * 2026-09-24, on a docs-only commit, over `/status`.
 *
 * The script is read as text rather than imported: it launches Chromium at
 * the top level.
 */

const SCRIPT = readFileSync('scripts/audit-mobile.mjs', 'utf8');

function pages(): string[] {
  const block = /const PAGES = \[([\s\S]*?)\];/.exec(SCRIPT)?.[1];
  if (!block) throw new Error('PAGES not found in scripts/audit-mobile.mjs');
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('audit:mobile page list', () => {
  it('parses a plausible list', () => {
    expect(pages().length).toBeGreaterThanOrEqual(8);
  });

  it('names no redirects() source', async () => {
    const sources = new Set((await nextConfig.redirects()).map((r: { source: string }) => r.source));
    expect(pages().filter((p) => sources.has(p))).toEqual([]);
  });

  it('names no page that redirects a signed-out visitor from inside the page', () => {
    // /status sends a non-admin to /login with redirect(), which arrives as a
    // meta refresh under the loading boundary. It is known, so it is named.
    expect(pages()).not.toContain('/status');
  });

  it('refuses a page that landed elsewhere or carries a refresh, before the settle', () => {
    const loop = SCRIPT.slice(SCRIPT.indexOf('for (const path of PAGES)'));
    const landed = loop.indexOf('if (landed !== path)');
    const refresh = loop.indexOf('meta[http-equiv="refresh" i]');
    const settle = loop.indexOf('waitForTimeout(1200)');
    expect(landed).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(Math.max(landed, refresh));
  });
});
