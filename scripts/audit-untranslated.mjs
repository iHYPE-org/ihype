#!/usr/bin/env node
/**
 * Member-facing English that was never wrapped in `t()`.
 *
 * ## Why nothing else can see this
 *
 * `i18n-parity.test.ts` asks whether every `t()` CALL has an English fallback
 * and whether the dictionaries agree with it. It is blind by construction to
 * the string that was never passed to `t()` at all: to that test, a page with
 * one translated word and forty hardcoded ones looks finished.
 *
 * That is exactly the state the shell was left in. On 2026-09-10 the last
 * member-facing dictionary gap closed — every key a `t()` call names exists in
 * all eleven locales — and `/app/me/notifications` still renders "Me · Settings"
 * and "Notifications" as literal JSX. Both facts are true at once, which is
 * why the backlog item kept reading as nearly done.
 *
 * The figure in the backlog ("21 pages, 22 components") predates several
 * rewrites and had never been re-measured. This script is what makes it a
 * number rather than a memory.
 *
 * ## What it looks at, and what it refuses to guess
 *
 * Member-facing surfaces only: `src/app/app/` (the signed-in shell) and
 * `src/components/`, minus `src/components/admin/`. The admin console ships in
 * English on purpose — see the `admin*` namespaces in the dictionaries — and
 * counting it would bury the 100-odd strings that matter under 500 that do not.
 *
 * Two kinds of finding, both of which reach a member's eyes:
 *
 *   TEXT   JSX text content — `<p>Save your ticket</p>`
 *   ATTR   a user-visible attribute — placeholder, aria-label, title, alt
 *
 * Deliberately NOT reported, because each would be noise a reader learns to
 * scroll past:
 *
 *   - anything inside a comment (masked first — `audit:css`, the i18n
 *     extractor and the AUTH_SECRET guard have each acted on their own
 *     documentation, and `scripts/lib/mask-comments.mjs` exists so the next
 *     scanner does not);
 *   - strings with no lowercase letters (`OK`, `QR`, `—`, `2026`), which are
 *     glyphs, acronyms and numbers rather than prose;
 *   - single words under four characters, which are overwhelmingly units and
 *     separators;
 *   - anything that looks like code rather than prose: a URL, a path, a class
 *     list, an identifier in camelCase or kebab-case, a template expression;
 *   - `aria-hidden` decorations and `data-*`.
 *
 * It reports FILES and LINES, not a translation. Wrapping a string is a
 * judgement about what the sentence is for — a field label is a control's
 * name, an eyebrow is metadata — and this script has no opinion about that.
 *
 * ## The ratchet
 *
 * `--max=N` is the number of hardcoded member-facing strings tolerated. It
 * starts at whatever the first honest run measures and must go DOWN. It is
 * advisory until that first tranche is paid down, for the reason
 * `audit:spacing` is advisory: a gate at a number nobody has agreed to pay is
 * a gate people switch off.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { maskComments } from './lib/mask-comments.mjs';

const ROOTS = ['src/app/app', 'src/components'];
const SKIP_DIRS = new Set(['admin', '__tests__', 'ds']);
/* Tests, and the admin console wherever it lives. `AdminAdsClient` sits in
   `src/components/` rather than `src/components/admin/`, and the console is
   deliberately English — the same call the dictionaries make by leaving every
   `admin*` namespace untranslated. Excluded by NAME as well as by directory,
   because one file in the wrong folder would otherwise put admin strings in a
   member-facing count. */
const SKIP_FILES = /\.(test|spec)\.tsx?$|(^|\/)Admin[A-Z][^/]*\.tsx$/;

const maxArg = process.argv.find((arg) => arg.startsWith('--max='));
const max = maxArg ? Number.parseInt(maxArg.slice('--max='.length), 10) : Number.POSITIVE_INFINITY;
const verbose = process.argv.includes('--list');

/** User-visible attributes. `title` is a tooltip; `alt` is read aloud. */
const VISIBLE_ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'aria-description'];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry) && !SKIP_FILES.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Prose a member reads, as opposed to a token the machine reads.
 *
 * The bar is deliberately conservative: a false positive here costs a reader
 * their trust in the whole list, and the strings this misses are still findable
 * by the next run once the obvious ones are gone.
 */
function isProse(raw) {
  const text = raw.trim();
  if (text.length < 4) return false;
  if (!/[a-z]/.test(text)) return false;              // OK, QR, 2026, —
  if (!/[A-Za-z]{3}/.test(text)) return false;        // needs a real word
  if (/^[a-z]+([A-Z][a-z]*)+$/.test(text)) return false;   // camelCase identifier
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(text)) return false; // kebab-case token
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(text)) return false; // snake_case token
  if (/^(https?:)?\/\//.test(text) || text.startsWith('/')) return false;  // URL or path
  if (/^[\w.-]+@[\w.-]+$/.test(text)) return false;   // an address
  if (/^\d/.test(text) && !/\s/.test(text)) return false;  // 12px, 2026-09-10
  if (text.includes('${')) return false;              // a template, reported at its parts
  // A run of class names: several lowercase tokens, no sentence punctuation.
  if (/^[a-z][\w-]*( [a-z][\w-]*)+$/.test(text) && !/[.,!?:;]/.test(text) && text.split(' ').length > 2) return false;
  return true;
}

/**
 * A captured run that is really source, not prose.
 *
 * A regex that knows only angle brackets cannot tell `<p>Hello</p>` from
 * `index >= 0 && index < len` or from the middle of a nested ternary — both
 * open with a comparison `>` and close on the next `<`. The findings look like
 * `"= 0 && index"` and `": state === 'fail' ?"`, and a scanner whose list
 * contains those is one people stop reading, which costs more than the strings
 * it would have found.
 */
const CODE_FRAGMENT = /^[=:?]|&&|\|\||===|!==|=>|;\s*$/;

/** True when the match sits inside a `t(...)` call on the same line. */
function insideTranslation(line, index) {
  const before = line.slice(0, index);
  const opens = (before.match(/\bt\(/g) || []).length;
  if (opens === 0) return false;
  const lastOpen = before.lastIndexOf('t(');
  const after = before.slice(lastOpen);
  // Unbalanced parens after the last `t(` means we are still inside it.
  return (after.match(/\(/g) || []).length > (after.match(/\)/g) || []).length;
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = readFileSync(file, 'utf8');
    const masked = maskComments(source);
    const lines = masked.split('\n');
    const rel = relative(process.cwd(), file);

    lines.forEach((line, i) => {
      // ── ATTR ──────────────────────────────────────────────────────────
      for (const attr of VISIBLE_ATTRS) {
        const re = new RegExp(`\\b${attr}=(["'])([^"'{}]+)\\1`, 'g');
        let m;
        while ((m = re.exec(line)) !== null) {
          if (!isProse(m[2])) continue;
          findings.push({ file: rel, line: i + 1, kind: 'ATTR', text: m[2], attr });
        }
      }

      // ── TEXT ──────────────────────────────────────────────────────────
      // JSX text between a closing `>` and an opening `<`, on one line.
      const re = />([^<>{}\n]+)</g;
      let m;
      const lineTranslates = /\bt\(/.test(line);
      while ((m = re.exec(line)) !== null) {
        const text = m[1];
        /* `index >= 0 && index < queue.length` reads as JSX text to a regex
           that only knows angle brackets, and a scanner whose list contains
           "= 0 && index" is one people stop reading. A captured run starting
           with `=` is the tail of `>=`; a boolean operator inside it is code. */
        if (CODE_FRAGMENT.test(text)) continue;
        if (!isProse(text)) continue;
        if (insideTranslation(line, m.index)) continue;
        /* A bare single word on a line that DOES translate its prose is an
           emphasis or a brand the author left alone on purpose — the vendor
           names in the privacy panel's `<strong>` tags are the example. */
        if (lineTranslates && !/\s/.test(text.trim())) continue;
        findings.push({ file: rel, line: i + 1, kind: 'TEXT', text: text.trim() });
      }
    });
  }
}

const byFile = new Map();
for (const f of findings) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
const ranked = [...byFile.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\nHardcoded member-facing strings: ${findings.length} across ${byFile.size} file(s)\n`);
for (const [file, count] of ranked.slice(0, verbose ? ranked.length : 25)) {
  console.log(`  ${String(count).padStart(4)}  ${file}`);
}
if (!verbose && ranked.length > 25) console.log(`  ...and ${ranked.length - 25} more file(s) (--list for all)`);

if (verbose) {
  console.log('');
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  ${f.kind}${f.attr ? `(${f.attr})` : ''}  ${JSON.stringify(f.text.slice(0, 80))}`);
  }
}

console.log('');
if (findings.length > max) {
  console.error(`FAIL — ${findings.length} hardcoded strings, budget ${max}.`);
  process.exit(1);
}
if (Number.isFinite(max)) console.log(`Within the budget of ${max}.`);
