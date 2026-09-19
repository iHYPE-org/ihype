#!/usr/bin/env node
/**
 * DESIGN_SYNC.md row numbers are ADDRESSES, and two rows may not share one.
 *
 * CLAUDE.md cites rows by number ("DESIGN_SYNC row 346", "row 413", …), so a
 * duplicate does not corrupt anything today — it sends the next reader who
 * follows a citation to whichever row their grep hits first. That is the same
 * shape as a stale path in the page map: valid prose, correct code, a wrong
 * PAIRING no compiler compares.
 *
 * WHY THIS EXISTS. Two rows collide when parallel PRs each append a row and
 * pick the same next number. **The merge is CLEAN** — neither side edits the
 * other's line, so git resolves nothing, no conflict is raised, and no gate
 * here looked at numbering. One branch (#1008) was renumbered 473 -> 483 ->
 * 485 -> 486 in a single afternoon as #1007, #1009 and #1010 each took a
 * number in turn; #1012 then merged carrying a stale 486 and collided with it
 * on main, where it sat undetected. Row 182 had been duplicated since
 * 2026-07-13 and nobody had ever noticed.
 *
 * THE PREVENTIVE HALF IS THE POINT. Detection catches a collision after it is
 * written; printing the next free number stops it being written. Every run
 * ends by naming it, so an author appending a row has the answer in front of
 * them rather than deriving it from a file that is not in numeric order.
 *
 * It judges LINE-INITIAL `| NNN |` only. A row's own prose routinely quotes a
 * row marker mid-line, and a scanner that reads its own documentation as its
 * own data is a defect this repository has recorded four times
 * (`scripts/lib/mask-comments.mjs` exists for it).
 *
 * Exit 0 clean · 1 over budget · 2 refused to judge (read no rows).
 */
import { readFileSync } from 'node:fs';

const DOC = 'DESIGN_SYNC.md';
const ROW_RE = /^\| (\d{3}) \|/;

const max = Number((process.argv.find((a) => a.startsWith('--max=')) || '--max=0').slice(6));

let text;
try {
  text = readFileSync(DOC, 'utf8');
} catch {
  console.error(`audit:sync-rows — ${DOC} could not be read from ${process.cwd()}.`);
  console.error('A gate that cannot find its own input must not report a pass.');
  process.exit(2);
}

/** Every row, in file order, with the line it sits on. */
const rows = [];
text.split('\n').forEach((line, i) => {
  const m = ROW_RE.exec(line);
  if (m) rows.push({ n: Number(m[1]), line: i + 1, text: line });
});

// A zero is earned, never assumed: an empty read is what a renamed file and a
// clean file both look like from the count alone.
if (rows.length === 0) {
  console.error(`audit:sync-rows — read 0 row(s) from ${DOC}.`);
  console.error('That is what a renamed or moved file looks like, not what a clean one looks like.');
  process.exit(2);
}

const byNumber = new Map();
for (const r of rows) {
  if (!byNumber.has(r.n)) byNumber.set(r.n, []);
  byNumber.get(r.n).push(r);
}

const duplicates = [...byNumber.entries()].filter(([, rs]) => rs.length > 1).sort((a, b) => a[0] - b[0]);

const numbers = [...byNumber.keys()].sort((a, b) => a - b);
const lowest = numbers[0];
const highest = numbers[numbers.length - 1];
const present = new Set(numbers);
const gaps = [];
for (let n = lowest; n < highest; n += 1) if (!present.has(n)) gaps.push(n);

/** The first ~90 characters of a row, enough to tell two rows apart. */
const summarise = (r) => r.text.slice(0, 110).replace(/\s+/g, ' ');

console.log(
  `audit:sync-rows — ${rows.length} row(s) in ${DOC}, ${byNumber.size} distinct number(s), range ${lowest}-${highest}.`,
);

if (duplicates.length > max) {
  console.log(`\n${duplicates.length} row number(s) used more than once:\n`);
  for (const [n, rs] of duplicates) {
    console.log(`  ${n} — ${rs.length} rows`);
    for (const r of rs) console.log(`      line ${r.line}: ${summarise(r)}`);
    console.log('');
  }
  console.log('Renumber the row that is cited LEAST — read the citing prose to decide which');
  console.log('row each "row NNN" reference actually means, and move any citation with it.');
  console.log(`Free numbers: ${gaps.length ? `${gaps.slice(0, 6).join(', ')}${gaps.length > 6 ? ', …' : ''}, ` : ''}${highest + 1}.`);
  console.log('Locate a row by its CONTENT, never by line number — this file moves under a branch.');
  process.exit(1);
}

if (duplicates.length) {
  console.log(`\n${duplicates.length} duplicate(s) within the budget of ${max}, named so the budget cannot hide them:`);
  for (const [n, rs] of duplicates) console.log(`  ${n} (${rs.length} rows, lines ${rs.map((r) => r.line).join(', ')})`);
}

// The preventive half: an author appending a row should not have to derive
// this from a file that is not in numeric order.
console.log(`\nNo row number is used twice. (budget ${max})`);
console.log(`Next free row number: ${highest + 1}${gaps.length ? `  ·  unused gaps: ${gaps.join(', ')}` : ''}`);
