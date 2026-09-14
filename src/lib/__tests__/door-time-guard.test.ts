import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * A SHOW'S `startsAt` IS ONLY EVER FORMATTED THROUGH `formatDoorTime` (or
 * `formatShowTime`, which is a thin wrapper over it) — DESIGN_SYNC row 464.
 *
 * The defect this exists to stop coming back: `startsAt` is an instant, so a
 * formatter with no zone renders it on whatever clock the RUNTIME is set to,
 * which on a Cloudflare Worker is UTC. Twenty-odd readers did exactly that, and
 * the result on the page that sells the ticket was a 9pm Saturday show in
 * Portland reading "Sunday, March 15 · 1:00 AM". Nothing in the type system can
 * see it: every one of those calls was well typed and returned a plausible
 * date.
 *
 * The check is deliberately textual and deliberately narrow — a line naming
 * `.startsAt` AND calling a date formatter. It cannot tell a show's `startsAt`
 * from an ad campaign's, so the handful of non-show ones are allowed BY NAME,
 * each with a reason, rather than by loosening the pattern: an allowlist that
 * has to be added to is a decision, and a pattern that stops matching is a
 * silence.
 */
const ROOT = join(process.cwd(), 'src');

/** Formatters that do NOT take a zone, and therefore render on the runtime's. */
const ZONELESS = /\b(?:formatDate|formatCalendarDay|toLocaleDateString|toLocaleTimeString|toLocaleString|toUTCString|toDateString|toTimeString)\s*\(/;

/**
 * Lines whose `startsAt` is not a show's. Each entry is `file::substring`, and
 * the test fails when one of them stops matching anything — a stale exemption
 * is the same defect as a missing one.
 */
const NOT_A_SHOW: { where: string; needle: string; why: string }[] = [
  {
    where: 'src/app/app/me/advertising/page.tsx',
    needle: 'campaign.startsAt',
    why: 'An Ad campaign term start — a platform date with no venue and no clock to be on.',
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('a show start is formatted on the venue clock', () => {
  const files = walk(ROOT);

  it('collected a plausible number of source files', () => {
    // A rename that empties the walk must break here rather than report a pass.
    expect(files.length).toBeGreaterThan(300);
  });

  it('has no zoneless formatter applied to a startsAt', () => {
    const offenders: string[] = [];
    const usedExemptions = new Set<string>();

    for (const file of files) {
      const rel = file.slice(process.cwd().length + 1);
      /* Mask comments first: this file's own prose names `startsAt` beside
         `toLocaleDateString`, and a scanner that reads its own documentation
         reports itself (the `mask-comments.mjs` rule). */
      const source = maskComments(readFileSync(file, 'utf8'));
      source.split('\n').forEach((line, i) => {
        if (!line.includes('.startsAt')) return;
        if (!ZONELESS.test(line)) return;
        const exempt = NOT_A_SHOW.find((e) => e.where === rel && line.includes(e.needle));
        if (exempt) {
          usedExemptions.add(`${exempt.where}::${exempt.needle}`);
          return;
        }
        offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }

    expect(offenders, 'Use formatDoorTime(locale, startsAt, show.timeZone, …) — a show start rendered with no zone is the Worker\'s UTC clock, not the venue\'s').toEqual([]);
    for (const e of NOT_A_SHOW) {
      expect(usedExemptions, `stale exemption: ${e.where}::${e.needle}`).toContain(`${e.where}::${e.needle}`);
    }
  });
});
