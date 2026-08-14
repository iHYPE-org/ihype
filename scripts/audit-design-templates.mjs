#!/usr/bin/env node
/**
 * Audits the DESIGN SYSTEM against its own rules.
 *
 * Every other audit in this repo checks the code against the design system.
 * This one runs the other way, and it exists because the assumption underneath
 * all the others turned out to be false: on 2026-08-14 a check of the 41
 * templates in `design/design-system-8/templates/` found 25 of them breaking
 * rules the design system itself publishes in ADHERENCE.md — emoji it bans
 * outright, and a DJ role deleted from the product on 2026-08-06.
 *
 * That matters more than a normal styling defect, because the templates are
 * the source of truth. A session told to "apply the template" faithfully will
 * re-introduce a deleted role or an emoji into live code, and be right to,
 * since the handoff is supposed to win. The failure is silent in both
 * directions: nothing in the code review catches it (the code is following its
 * source) and nothing in the design system catches it either.
 *
 * So the rule this encodes is: a template that contradicts ADHERENCE.md is a
 * DESIGN defect, to be fixed in Claude Design and re-vendored — never worked
 * around by inventing corrections in the .tsx. Correcting it in code only
 * means the next session re-applies the template and puts it back.
 *
 * What it checks, all of them rules ADHERENCE.md states in its own words:
 *
 *   - emoji            §29 "No emoji, anywhere." Unicode glyphs are fine.
 *   - dj-role          §4  "There is no DJ role. Deleted 2026-08-06."
 *   - promoter-role    §3  "Promoter is not an account role." Only flagged
 *                          where it appears AS a role, never for the 10%
 *                          split slice, which is what the word legitimately
 *                          describes nearly everywhere it appears.
 *   - ink-on-accent    §32 + the token note in CLAUDE.md: white on the accent
 *                          measures 3.27:1 and fails AA. The system's own
 *                          templates carry var(--ink-on-accent,#0b1220).
 *
 *     npm run audit:design            summary
 *     npm run audit:design -- --list  every finding, per template
 *     npm run audit:design -- --strict  exit 1 if anything is found
 *
 * Advisory by default ON PURPOSE, and this one should stay advisory: the fix
 * lives in another repository, so a red build here could not be cleared by
 * anyone working in this one.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'design/design-system-8/templates';
const ARGS = process.argv.slice(2);
const LIST = ARGS.includes('--list');
const STRICT = ARGS.includes('--strict');

/**
 * Pictographs only. The design system explicitly ALLOWS Unicode glyphs — "▶ ❚❚
 * ♥ ♡ ✕ ◂ ›" by name, and ✓ ⚠ ⚙ ✉ by the same logic — so a naive "non-ASCII"
 * or whole-Miscellaneous-Symbols check reports those as violations and gets
 * switched off within a day. It flagged 159 on its first run and about half
 * were ♡ and ✓.
 *
 * Two rules, matching how Unicode itself draws the line:
 *   - U+1F000–1FAFF is emoji by default, no qualifier needed;
 *   - U+2600–27BF is TEXT presentation by default (✕ is U+2715), and only
 *     becomes emoji when followed by the U+FE0F variation selector. So it is
 *     flagged only with FE0F — ⚠ passes, ⚠️ does not.
 */
const EMOJI = /[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]\u{FE0F}/gu;

/**
 * The DJ role as a ROLE — a variant, a picker option, a dashboard mode. Not
 * the letters "dj": `templates/` legitimately contains the word inside prose
 * explaining the removal, and inside `disc jockey`-free words like "adjust".
 */
const DJ_ROLE = /(['"`])dj\1|role\s*===\s*['"]dj['"]|isDj\b|\bDJ\s+(?:Caro|profile|dashboard|role)\b|Artist\/DJ\/Venue/gi;

/** Promoter as an ACCOUNT TYPE, not as the 10% split slice. */
const PROMOTER_ROLE = /(['"`])promoter\1|isPromoter\b|role\s*===\s*['"]promoter['"]|promoter\s+(?:account|signup|role|verification)/gi;

/** White on an accent fill. `#fff` elsewhere (a QR quiet zone, say) is fine. */
const WHITE_ON_ACCENT = /background:\s*(?:var\(--accent[^)]*\)|#ff5029)[^;"]*;\s*color:\s*(?:#fff\b|#ffffff\b|white\b)|color:\s*(?:#fff\b|#ffffff\b|white\b)[^;"]*;\s*background:\s*(?:var\(--accent[^)]*\)|#ff5029)/gi;

const CHECKS = [
  { id: 'emoji', rule: 'ADHERENCE §29 — no emoji, anywhere', re: EMOJI },
  { id: 'dj-role', rule: 'ADHERENCE §4 — there is no DJ role', re: DJ_ROLE },
  { id: 'promoter-role', rule: 'ADHERENCE §3 — promoter is not an account role', re: PROMOTER_ROLE },
  { id: 'ink-on-accent', rule: 'ADHERENCE §32 — white on accent is 3.27:1, fails AA', re: WHITE_ON_ACCENT },
];

if (!existsSync(ROOT)) {
  console.error(`No ${ROOT}. Is the design system vendored?`);
  process.exit(1);
}

const templates = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const findings = [];

for (const name of templates) {
  const dir = join(ROOT, name);
  const files = readdirSync(dir).filter((file) => file.endsWith('.dc.html') || file.endsWith('.html'));
  for (const file of files) {
    const source = readFileSync(join(dir, file), 'utf8');
    for (const check of CHECKS) {
      const matches = source.match(check.re);
      if (!matches?.length) continue;
      // Report the distinct forms, not the raw count: "9 emoji" is a number,
      // "🔥 🎟️ 📣" is something a designer can act on.
      const samples = [...new Set(matches.map((m) => m.trim()))].slice(0, 6);
      findings.push({ template: name, file, check: check.id, rule: check.rule, count: matches.length, samples });
    }
  }
}

const byTemplate = new Map();
for (const finding of findings) {
  if (!byTemplate.has(finding.template)) byTemplate.set(finding.template, []);
  byTemplate.get(finding.template).push(finding);
}

console.log('');
console.log('  DESIGN SYSTEM SELF-AUDIT');
console.log('');
console.log(`  ${templates.length} template(s) checked against ADHERENCE.md`);
console.log(`  ${byTemplate.size} with findings · ${findings.length} finding(s) total`);
console.log('');

for (const check of CHECKS) {
  const hits = findings.filter((finding) => finding.check === check.id);
  if (!hits.length) continue;
  const total = hits.reduce((sum, hit) => sum + hit.count, 0);
  console.log(`  ${String(total).padStart(4)}  ${check.id.padEnd(14)} in ${hits.length} template(s) — ${check.rule}`);
}

if (LIST) {
  console.log('');
  for (const [template, list] of [...byTemplate].sort()) {
    console.log(`  ── ${template} ${'─'.repeat(Math.max(0, 46 - template.length))}`);
    for (const finding of list) {
      console.log(`       ${finding.check} ×${finding.count}  ${finding.samples.join('  ')}`);
    }
  }
}

console.log('');
console.log('  These are DESIGN defects. Fix them in Claude Design and re-vendor —');
console.log('  never by correcting the template in .tsx, which the next session undoes.');
console.log('');

if (STRICT && findings.length) process.exit(1);
