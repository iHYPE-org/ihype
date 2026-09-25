import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * iHYPE'S CUT IS 0%, AND NO SURFACE MAY INVENT ONE.
 *
 * The charter splits a ticket 70/20/10 — artist, venue, promoters — and
 * iHYPE keeps nothing. `TransparencyPanel` publishes that to the public in
 * those words: "iHYPE charges 0% on every transaction." The only figure that
 * is ever charged above face value is Stripe's own processing fee, at cost.
 *
 * And yet until 2026-09-15 the operator console carried a **"Platform fee
 * est. (10%)"** figure in TWO places — `/admin/finance` and `/admin`'s own
 * Revenue block — each computed as `Math.round(revenueCents * 0.1)`. So the
 * console told its own operators a number the product's public report
 * contradicts, on the one screen where somebody decides what the business
 * earns.
 *
 * Three things were wrong at once, and the third is why this is a test rather
 * than a correction:
 *
 * 1. **iHYPE charges no fee at all**, so the quantity does not exist.
 * 2. **The 10% that does exist is the PROMOTER POOL** — the affiliate share,
 *    somebody else's money — so naming it a platform fee misattributes it to
 *    the platform.
 * 3. **Even as an estimate of that pool the arithmetic was wrong**, because
 *    it took 10% of `totalChargeCents`, which carries taxes and the 1.5%
 *    reserve ABOVE face value; the promoter share is a split of face value.
 *
 * `audit:retired-claims` is the usual home for a claim the product stopped
 * being able to make, and it deliberately skips `admin/` — the console ships
 * in English by decision, and widening that scanner would pull the whole
 * console into a member-facing gate. So the rule lives here, where it can
 * cover the console and everything else in one pass.
 *
 * THE RULE IS NOT "NEVER SAY PLATFORM FEE" — IT IS THAT A PLATFORM FEE MUST
 * BE NAMED AS ZERO. The first draft of this test refused the phrase outright
 * and immediately flagged five honest surfaces that say exactly the right
 * thing: "0% platform fee, always" on `/for-artists`, "$0 · Platform fee on
 * tickets", "$0 platform fees" on `/welcome`, and the terms' own "iHYPE
 * charges $0 in platform fees — this is locked in our charter". Those
 * sentences are the claim the console contradicted; deleting them to satisfy
 * a scanner would have removed the truth and kept nothing. So each occurrence
 * is read with its surroundings and must carry a zero.
 *
 * WHAT IS ALLOWED. A real promoter figure read from `AccountsPayableEntry`
 * rows (`PROMOTER_AFFILIATE`) is a measurement, not a fee, and no pattern
 * here matches one. What is refused is a non-zero fee, and any percentage of
 * revenue presented as iHYPE's own take.
 */

const SRC = join(process.cwd(), 'src');
const SKIP = new Set(['node_modules', '__tests__', 'ds']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      out.push(...walk(join(dir, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/* Comments are masked first, for the reason `mask-comments.mjs` exists: the
   block above this test names the retired phrase four times, and a scanner
   that reads its own explanation as a finding is a defect this repository has
   shipped four separate times. */
const files = walk(SRC).map((path) => ({ path, source: maskComments(readFileSync(path, 'utf8')) }));

describe('there is no iHYPE platform fee', () => {
  it('collected a plausible number of source files', () => {
    /* A zero here would make every assertion below vacuous — the same
       refusal `audit:doc-paths` and `audit:mounts` make. */
    expect(files.length).toBeGreaterThan(200);
  });

  it('names a platform fee only as zero', () => {
    /* Read each mention with 60 characters either side and require a zero in
       that window: "$0", "0%", "zero". A fee stated as anything else — a
       percentage, an estimate, a dollar figure — is the defect. */
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const m of source.matchAll(/platform\s*fees?/gi)) {
        const at = m.index ?? 0;
        const window = source.slice(Math.max(0, at - 60), at + m[0].length + 60);
        if (!/\$\s*0(?!\.\d*[1-9])|\b0\s*%|\bzero\b/i.test(window)) {
          offenders.push(`${path.replace(`${process.cwd()}/`, '')} :: ${window.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
        }
      }
    }
    expect(offenders, 'iHYPE charges 0%; the only fee on a ticket is Stripe’s card fee').toEqual([]);
  });

  it('still says so on the surfaces that promise it', () => {
    /* The complement, so a later pass cannot satisfy the rule above by
       deleting the promise instead of the false figure. */
    const promises = files.filter((f) => /platform\s*fees?/i.test(f.source));
    expect(promises.length, 'somebody must still state the 0%').toBeGreaterThan(3);
  });

  it('derives no figure from a tenth of revenue', () => {
    /* The shape the two console sites used. A percentage of revenue is only
       ever the promoter pool, and that is read from payable rows. */
    const offenders = files
      .filter((f) => /revenue\w*\s*\*\s*0?\.1\b/i.test(f.source))
      .map((f) => f.path.replace(`${process.cwd()}/`, ''));
    expect(offenders, 'a share of revenue is read from AccountsPayableEntry, never multiplied out').toEqual([]);
  });

  it('still states 0% to the public', () => {
    /* The other half of the rule: deleting the false figure must not also
       delete the true claim it contradicted. */
    const panel = files.find((f) => f.path.endsWith('info/TransparencyPanel.tsx'));
    expect(panel, 'TransparencyPanel.tsx').toBeTruthy();
    expect(panel!.source).toMatch(/charges 0%/);
  });
});
