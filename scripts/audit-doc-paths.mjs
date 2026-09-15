#!/usr/bin/env node
/*
  A PATH NAMED BY THE MEMORY THAT RESOLVES TO NOTHING.

  CLAUDE.md is what a cold session reads to find a surface, and it says so
  about itself twice:

    "This row read `src/app/auth/login/page.tsx` until 2026-08-05 — a path
     that has never existed, so every session that went looking for the
     sign-in page found nothing and moved on. That is why the auth screens
     are the last un-synced surface in the app."

    "This row exists because the table's whole job is 'never overwrite
     these', and a row naming a path that is not there invites the next
     session to recreate the file rather than find where it went. Verified
     2026-09-04 by resolving all 260 paths this document names."

  That verification was a one-off, and it went stale the way a one-off does:
  by 2026-09-13 the page map named 37 files that were not there — sixteen
  that had MOVED under `/app/*` in the shell cutover, twenty that survive
  only as `redirects()` entries, and one route handler the map called a page.
  Four of them described the DJ role, deleted 2026-08-06, complete with a
  gate on a `profile.type` value the enum cannot hold.

  Nothing was broken in the product. That is exactly what makes this worth a
  gate: a stale map costs nothing today and misdirects whoever reads it next,
  which is the same shape as `audit:retired-claims` — valid prose, correct
  code, a wrong PAIRING that no compiler compares.

  SCOPE IS CLAUDE.md ONLY, on purpose. DESIGN_SYNC.md is an append-only
  history: a row there naming a file that was deleted two months ago is the
  record doing its job, and scanning it would be all noise.

  THE EXEMPTION IS A RECORD, NOT A SILENCE. A row may name a dead path when
  the row says so — either in its own words (the vocabulary below, which is
  how the existing "Deleted 2026-09-01" and "Retired" rows already read) or
  with an explicit `doc-path-exempt: <reason>` marker. Both are counted and
  the count is printed, because an exemption nobody can see is the thing this
  repository keeps having to re-learn.
*/
import { readFileSync, existsSync } from 'node:fs';

const DOC = 'CLAUDE.md';
/* A repo-relative path the reader is meant to open. `design/` and
   `templates/` are vendored bundles that legitimately come and go with a
   re-vendor, and `prisma/migrations-pending/` empties by design, so all three
   stay out.

   IT WAS `src/` ALONE UNTIL 2026-09-15, AND THE THREE WORST CLAIMS IN THE
   FILE WERE OUTSIDE IT. `lib/api.js` ("use this as the API route reference.
   All endpoints are listed there"), `lib/NavShell.js` + `lib/shell.css`
   ("copy from Claude Design") and `scripts/export-tokens.js` ("run this if DS
   tokens changed") have never existed in ANY commit on ANY branch — `git log
   --all` returns zero for each. They are instructions a cold session cannot
   follow, which is the exact defect this file's own header describes costing
   it the auth screens for months, sitting in the one shape the gate could not
   see. Widening to these directories added 26 live-claimed paths and found
   nothing else dead, so it cost nothing and closes the class. */
/* The lookbehind bounds the prefix: unanchored, `lib` matches inside
   `mylib/api.js` and `public` inside `republic/x.ts`. A scanner wrong about
   its own inputs invents findings, and an invented finding is worse than a
   missed one — the lesson `audit:published-urls` records from its first
   draft. */
const PATH_RE = /(?<![\w/.-])((?:src|scripts|workers|e2e|public|lib)\/[a-zA-Z0-9_./[\]-]+\.(?:tsx?|mjs|mts|cjs|css|json|js)|\.github\/workflows\/[a-zA-Z0-9_.-]+\.ya?ml)/g;
/* How a row says "this is gone" in its own words. Kept deliberately broad:
   a false EXEMPTION is a missed finding, but a false FINDING on a row that
   plainly reads as history is how a gate gets switched off. */
const SAYS_GONE = /\b(delet|retir|remov|dropp|gone|moved|history|no longer|superseded|was deleted|stays? deleted)/i;
const MARKER = /doc-path-exempt:\s*\S/;

const max = Number((process.argv.find((a) => a.startsWith('--max=')) || '--max=0').slice(6));
const LIST_EXEMPT = process.argv.includes('--list-exempt');
const exemptedDead = [];
const lines = readFileSync(DOC, 'utf8').split('\n');

/* THE UNIT OF JUDGEMENT IS A TABLE ROW *OR* A PROSE BLOCK, and until
   2026-09-15 it was only the first. Every path claim the scanner could see
   had to live inside `| … |`, so the whole bottom third of the file — the
   sync workflow, the API-client note, the navigation note, the DO/DO NOT
   table's surrounding prose — was unscanned. That is where all three
   never-existed paths were: `lib/api.js`, `lib/NavShell.js` +
   `lib/shell.css`, `scripts/export-tokens.js`. A numbered instruction that
   names a file is a stronger claim than a table row, not a weaker one.

   A block is consecutive non-blank, non-table lines. The block rather than
   the line, because a "this is gone" sentence routinely sits one line away
   from the path it excuses — the same reason `exempt-lines.mjs` exists. */
const units = [];
let block = [];
let blockLine = 0;
const flush = () => {
  if (block.length) units.push({ text: block.join('\n'), label: `line ${blockLine}`, kind: 'prose' });
  block = [];
};
lines.forEach((line, i) => {
  if (line.startsWith('| ')) {
    flush();
    units.push({ text: line, label: line.split('|')[1].trim().slice(0, 60), kind: 'row' });
    return;
  }
  if (line.trim() === '') { flush(); return; }
  if (!block.length) blockLine = i + 1;
  block.push(line);
});
flush();

const rows = units.filter((u) => u.kind === 'row');
const where = (f) => (f.kind === 'row' ? `in the row headed: ${f.row}…` : `in the prose at ${f.row}`);
const findings = [];
let exemptRows = 0;
let considered = 0;
for (const unit of units) {
  const paths = [...new Set([...unit.text.matchAll(PATH_RE)].map((m) => m[1]))];
  if (paths.length === 0) continue;
  /* MASK THE PATHS BEFORE ASKING WHETHER THE UNIT SAYS "GONE". Testing the
     raw text lets a FILENAME satisfy the vocabulary — measured: a probe path
     called `permissions-GONE.ts` exempted its own row, so the scanner read
     its own data as its own instruction. The fourth instance of that trap in
     this repository, and the reason `mask-comments.mjs` exists. */
  const prose = unit.text.replace(PATH_RE, ' ');
  const exempt = MARKER.test(prose) || SAYS_GONE.test(prose);
  if (exempt) {
    exemptRows += 1;
    if (LIST_EXEMPT) for (const p of paths) if (!existsSync(p)) exemptedDead.push({ p, row: unit.label, kind: unit.kind });
    continue;
  }
  for (const p of paths) {
    considered += 1;
    if (!existsSync(p)) findings.push({ p, row: unit.label, kind: unit.kind });
  }
}

/* A zero is earned rather than assumed. If the document stops being a table,
   or the path shape changes, this reports nothing and would read as a pass —
   the same failure `audit:mounts` refuses by exiting on an empty collection. */
if (considered < 100) {
  console.error(`audit:doc-paths — only ${considered} path(s) considered across ${rows.length} table row(s) and ${units.length - rows.length} prose block(s).`);
  console.error('That is implausibly low: the scan found nothing to check rather than nothing wrong.');
  process.exit(2);
}

console.log(`audit:doc-paths — ${considered} live-claimed path(s) across ${rows.length} table row(s) and ${units.length - rows.length} prose block(s) of ${DOC}.`);
console.log(`${exemptRows} row(s)/block(s) name a path and say it is gone; those are not checked.`);
if (LIST_EXEMPT) {
  console.log(`\n${exemptedDead.length} dead path(s) inside those exempt rows — run this when the vocabulary feels too broad:\n`);
  for (const f of exemptedDead) console.log(`  ${f.p}\n      ${where(f)}`);
}

if (findings.length > max) {
  console.log(`\n${findings.length} path(s) named by a row or block that does NOT say the file is gone:\n`);
  for (const f of findings) console.log(`  ${f.p}\n      ${where(f)}\n`);
  console.log('Either correct the path to where the surface actually lives, say in the row that it is');
  console.log('gone, or add `doc-path-exempt: <reason>` there. Never delete the row silently —');
  console.log('a session that cannot find a surface rebuilds it.');
  process.exit(1);
}
console.log(`\nEvery path the memory presents as live resolves. (budget ${max})`);
