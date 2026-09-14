import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * Every switch the admin console offers is read by something that ENFORCES it.
 *
 * The flag board on `/admin`'s System tab is a row of controls, and a control
 * is a promise that pressing it changes something (DESIGN_SYNC row 385). Twice
 * now a flag has been drawn there, written to KV by `POST /api/admin/flags`,
 * recorded in the audit log as an override — and read by nothing but the
 * console itself: `demo_logins` and `hide_demo_content` until 2026-09-06 (row
 * 353), and `ticket_payment_capture` until 2026-09-14, which an operator could
 * switch Off during a payments incident and watch tickets keep selling. The
 * type system cannot see this: a flag with no reader is a string in a Set, and
 * `getRuntimeFlag` is happy to fall back for a key nobody asks about.
 *
 * So the rule is checked the way `audit:mounts` checks components — by asking
 * who reads the thing. A flag counts as enforced when a file OUTSIDE the
 * display set (the console page, the flags route, `/api/health`, the feature
 * board, and `runtime-flags.ts` itself) either names the key or calls a
 * `runtime-flags.ts` helper whose body reads that key.
 *
 * The second rule is the other half of the same failure. The board once read
 * `blob_media_storage` through an inline `getRuntimeFlag(...)` with its OWN
 * fallback ("is R2 configured", true in production) while the upload route
 * read it through a helper whose fallback is false in production — so with no
 * override stored the board showed Enabled over an enforcing value of Off,
 * under a label that meant the opposite of what the flag decides. A display
 * that carries its own default can disagree with the thing it displays;
 * `getRuntimeFlag` is therefore called inline only inside `runtime-flags.ts`,
 * and every other reader goes through a named helper that both sides share.
 */

const ROOT = process.cwd();

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : [],
  );
}

function code(file: string): string {
  return maskComments(readFileSync(file, 'utf8'));
}

const DISPLAY_SET = new Set([
  'src/app/admin/page.tsx',
  'src/app/api/admin/flags/route.ts',
  'src/lib/runtime-flags.ts',
  'src/lib/health.ts',
  'src/lib/admin-feature-board.ts',
  'src/lib/admin-feature-board-data.ts',
]);

function allowedFlags(): string[] {
  const route = code(join(ROOT, 'src/app/api/admin/flags/route.ts'));
  const start = route.indexOf('const ALLOWED_FLAGS');
  const block = route.slice(start, route.indexOf(']);', start));
  return [...block.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

/** Exported helpers in `runtime-flags.ts` whose body reads the given key. */
function helpersReading(flagsSource: string, key: string): string[] {
  const names: string[] = [];
  const exportRe = /export (?:const|async function|function) (\w+)/g;
  const positions = [...flagsSource.matchAll(exportRe)].map((match) => ({ name: match[1], at: match.index ?? 0 }));
  positions.forEach((entry, index) => {
    const end = index + 1 < positions.length ? positions[index + 1].at : flagsSource.length;
    const body = flagsSource.slice(entry.at, end);
    if (body.includes(`'${key}'`)) names.push(entry.name);
  });
  return names;
}

describe('runtime flag readers', () => {
  const flags = allowedFlags();
  const flagsSource = code(join(ROOT, 'src/lib/runtime-flags.ts'));
  const sources = [...listFiles(join(ROOT, 'src')), ...listFiles(join(ROOT, 'workers'))]
    .map((file) => ({ rel: file.slice(ROOT.length + 1).replaceAll('\\', '/'), text: code(file) }))
    .filter((file) => !DISPLAY_SET.has(file.rel));

  it('collected the board and the tree it is checked against', () => {
    /* A zero here is a broken scan, not a clean one — the same refusal every
       gate in this repository carries since row 433. */
    expect(flags.length).toBeGreaterThanOrEqual(5);
    expect(sources.length).toBeGreaterThan(100);
  });

  it('every flag the console offers is enforced by a reader outside the console', () => {
    const unenforced: string[] = [];
    for (const key of flags) {
      const helpers = helpersReading(flagsSource, key);
      const readers = sources.filter((file) =>
        file.text.includes(`'${key}'`) || helpers.some((helper) => new RegExp(`\\b${helper}\\b`).test(file.text)),
      );
      if (readers.length === 0) unenforced.push(key);
    }
    expect(
      unenforced,
      `switches on /admin that nothing enforces: ${unenforced.join(', ')} — delete the flag or wire a reader`,
    ).toEqual([]);
  });

  it('the display set reads every flag through the helper the enforcer uses, never inline', () => {
    const inline = [...DISPLAY_SET]
      .filter((rel) => rel !== 'src/lib/runtime-flags.ts')
      .filter((rel) => /\bgetRuntimeFlag\s*\(/.test(code(join(ROOT, rel))));
    expect(inline, 'a display that supplies its own fallback can disagree with the thing it displays').toEqual([]);
  });

  it('refuses a flag that exists only in the console (the guard is live in both directions)', () => {
    /* Prove the check can fail: a key nothing reads must come back unenforced. */
    const ghost = 'ghost_flag_nobody_reads';
    const helpers = helpersReading(flagsSource, ghost);
    const readers = sources.filter((file) => file.text.includes(`'${ghost}'`) || helpers.length > 0);
    expect(readers).toEqual([]);
    /* And prove a real one passes for the reason it should — through a helper,
       not a literal: `tickets_enabled` is enforced by the purchase route, which
       never writes the key's name. */
    const ticketHelpers = helpersReading(flagsSource, 'tickets_enabled');
    expect(ticketHelpers).toContain('isTicketingEnabledRuntime');
    expect(sources.some((file) => /\bisTicketingEnabledRuntime\b/.test(file.text))).toBe(true);
  });
});
