#!/usr/bin/env node
/**
 * RETIRED CAPABILITIES MUST NOT SURVIVE IN MEMBER-FACING COPY.
 *
 * THE DEFECT THIS EXISTS FOR. A capability is removed from the product and
 * the sentence selling it is left behind. Nothing can see that: the sentence
 * is valid English, the code around it is correct, the types are satisfied,
 * every test passes. Only the PAIRING is wrong, and no compiler compares a
 * claim to a codebase.
 *
 * It is not hypothetical and it is not rare. Twelve instances were found by
 * hand on 2026-09-11, all of them shipped:
 *
 *   - `/advertise` sold "spots per day" for a day after pricing moved to a
 *     flat monthly sponsorship, quoting a unit the product had stopped
 *     selling in (DESIGN_SYNC row 384).
 *   - The no-such-tab copy listed a "Library" tab retired five weeks before.
 *   - The advertiser dashboard, the cancel confirm and the SETTLEMENT EMAIL
 *     all spoke the retired per-impression model to sponsors — who are the
 *     only people buying. A sponsor who cancelled on day one of a term was
 *     refunded in full, correctly, and told their campaign "delivered less
 *     than the $0.50 minimum a card can be charged".
 *   - `/for-artists` advertised "Live show hosting — listener count, hype
 *     pulse, live chat": three capabilities that have never existed here.
 *   - `/for-venues` and `/for-fans` advertised an "AI Page Creator" deleted
 *     by owner instruction on 2026-09-01.
 *   - `/for-fans` offered "any DJ's live or recorded show" — no DJ role
 *     since 2026-08-06, and `isRadioShow` is read in eight places and
 *     WRITTEN BY NOTHING, so no such show can exist.
 *   - The public transparency page said the same thing about the money.
 *
 * The recruiting pages are the worst place for it: those sentences are read
 * before anyone has signed up, so the first thing the product does is make a
 * promise it cannot keep.
 *
 * WHAT THIS CAN AND CANNOT DO. "Does this sentence describe the product" is
 * not mechanisable. "Does this sentence use a word we retired" is, and it is
 * the same move `guard:design` makes by asserting deleted files stay deleted:
 * a retired thing comes back one sentence at a time, and each sentence looks
 * reasonable alone. The table below is the whole instrument — every entry
 * carries the date, the reason, and what is true instead, because an entry
 * that only says "banned" teaches the next reader nothing and gets deleted
 * the first time it is inconvenient.
 *
 * ADDING TO IT IS PART OF RETIRING SOMETHING. When a capability goes, its
 * vocabulary goes in here in the same change. That is the only way the list
 * stays honest — reconstructing it later means reading every page again,
 * which is exactly the cost this avoids.
 *
 * A GATE, NOT A RATCHET, AND THAT IS ONLY POSSIBLE BECAUSE THE DEBT IS PAID.
 * `audit:css` opened at 145 and `audit:untranslated` at 181, because a gate
 * over pre-existing debt blocks every merge and gets switched off. This opens
 * at zero: the pass that wrote it cleared the list first. Do not raise it —
 * add an exemption with a reason, or change the copy.
 *
 * SCOPE. Member-facing source only. The admin console ships in English by
 * decision and is excluded by name as well as by directory, the same rule
 * `audit:untranslated` makes and for the same reason — `AdminAdsClient` sits
 * outside `src/components/admin/`. Dictionaries are NOT scanned: a
 * translation whose English is gone is an orphaned key, which is a different
 * defect with a different fix.
 *
 * Comments are masked first (`scripts/lib/mask-comments.mjs`). This whole
 * file is a comment quoting every retired phrase, and a scanner that reads
 * its own documentation acts on it — the third time that has happened here.
 *
 *   node scripts/audit-retired-claims.mjs [--list] [--max=N] [--roots=a,b]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { maskComments } from './lib/mask-comments.mjs';
import { exemptLines } from './lib/exempt-lines.mjs';

/**
 * Each entry: what not to say, when it stopped being true, and what is.
 * `pattern` is matched case-insensitively against masked source.
 */
const RETIRED = [
  {
    pattern: /AI[- ]?(Page[- ]?Creator|built page|page builder)|AI[- ]?built\b/i,
    what: 'the AI page generator',
    retired: '2026-08-11, finished 2026-09-01 by owner instruction',
    instead: 'The profile editor is a fixed per-type form. Only /api/page-builder/ad-recs survives.',
  },
  {
    pattern: /\blive chat\b|\blistener count\b|\bhype pulse\b/i,
    what: 'live-show hosting telemetry',
    retired: 'never existed in this codebase',
    instead: 'There is no go-live, no live chat and no listener count. Do not advertise one.',
  },
  {
    pattern: /\bradio shows?\b|\bDJ'?s? (?:live|recorded|crate) (?:or recorded )?show/i,
    what: 'member-created radio shows',
    retired: 'RadioShowCreator retired; isRadioShow is read in 8 places and written by nothing',
    instead: 'The always-on station. Say "the station", never "radio shows" or "hosting".',
  },
  {
    pattern: /\bspots? per day\b|\beffective CPM\b|\bcost per 1,?000\b/i,
    what: 'per-impression ad pricing',
    retired: '2026-09-10 (DESIGN_SYNC row 384)',
    instead: 'A sponsorship buys a term in months. Metered copy must be gated on pricingModel.',
  },
  {
    pattern: /\bweekly (?:flame|hype) budget\b/i,
    what: 'a weekly hype allowance',
    retired: 'never existed',
    instead: 'HYPE_WINDOW_MS is 24 hours per act. One hype per act per day.',
  },
  {
    pattern: /\bevery DJ and promoter\b|\bDJ role\b/i,
    what: 'DJ as an account type',
    retired: '2026-08-06',
    instead: 'There is no DJ role and promoter is not a role — anyone can promote with a HYPE Link.',
  },
];

const rootsArg = process.argv.find((arg) => arg.startsWith('--roots='));
/* `--roots=` exists so a test can point this at a scratch directory. A probe
   dropped into `src/` breaks other suites that walk that tree under parallel
   execution — measured, on `audit-untranslated`'s own first test. */
const ROOTS = rootsArg
  ? rootsArg.slice('--roots='.length).split(',').filter(Boolean)
  : ['src/app', 'src/components', 'src/lib'];

const SKIP_DIRS = new Set(['admin', '__tests__', 'ds', 'node_modules']);
const SKIP_FILES = /\.(test|spec)\.tsx?$|(^|\/)Admin[A-Z][^/]*\.tsx?$/;

/**
 * The legal documents are out of scope, and the reason is narrower than it
 * looks. A licence grant naming a content type the product no longer offers
 * is OVER-BROAD, not a false promise to a member: it claims a right nobody is
 * exercising rather than advertising a capability nobody can use. Narrowing
 * it changes the substance of a binding document, which is an owner decision
 * with a lawyer in it, not a copy fix — and this scanner's whole premise is
 * that a claim can be corrected by rewording it.
 *
 * These three files are English on purpose (DESIGN_SYNC row 395); their
 * furniture is translated and `LegalLanguageNotice` says so in the reader's
 * own language. That decision is made and is not what this skip is waiting
 * on.
 */
const SKIP_PATHS = [/MmmTerms\.tsx$/, /MmmCharter\.tsx$/, /MmmInfoDocument\.tsx$/];

/** `retired-claim-exempt: <reason>` — the reason is required. */
const EXEMPT = /retired-claim-exempt:\s*\S/i;

const maxArg = process.argv.find((arg) => arg.startsWith('--max='));
const max = maxArg ? Number.parseInt(maxArg.slice('--max='.length), 10) : 0;
const verbose = process.argv.includes('--list');

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !SKIP_FILES.test(entry) && !SKIP_PATHS.some((re) => re.test(full))) {
      out.push(full);
    }
  }
  return out;
}

const files = ROOTS.flatMap((root) => walk(root));
/* A rename must break this script rather than have it report a triumphant
   zero over an empty file list — the rule `audit-routes` and `audit-mounts`
   both learned the hard way. */
if (files.length === 0) {
  console.error('audit:retired-claims found no files to scan. A path has moved; fix the roots.');
  process.exit(2);
}

const findings = [];
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const masked = maskComments(raw);
  const lines = masked.split('\n');
  /* Resolved by the shared rule rather than by a lookback: the hand-written
     one-line version here reproduced, within the hour, the exact bug
     `audit:untranslated` had already been bitten by twice. */
  const exempt = exemptLines(raw, EXEMPT);

  lines.forEach((line, i) => {
    if (exempt(i)) return;
    for (const entry of RETIRED) {
      const match = line.match(entry.pattern);
      if (match) findings.push({ file, line: i + 1, text: match[0].trim(), entry });
    }
  });
}

if (verbose || findings.length > max) {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  "${f.text}"`);
    console.log(`    ${f.entry.what} — retired ${f.entry.retired}`);
    console.log(`    ${f.entry.instead}`);
  }
}

const plural = findings.length === 1 ? 'claim' : 'claims';
if (findings.length > max) {
  console.error(`\n${findings.length} retired ${plural} in member-facing copy, budget ${max}.`);
  console.error('Change the copy, or mark it `retired-claim-exempt: <reason>` — the reason is required.');
  process.exit(1);
}
console.log(`audit:retired-claims — ${findings.length} ${plural} across ${files.length} files (budget ${max}).`);
