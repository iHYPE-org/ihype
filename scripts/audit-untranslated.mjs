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
 * ## Saying "this one is deliberately English"
 *
 * Some strings must NOT be translated and translating them would be the bug:
 * the `© OpenStreetMap · CARTO` basemap attribution names two organisations
 * and is a licence condition, not copy. Write `i18n-exempt: <why>` in a
 * comment on the line or the line above and the finding is dropped, with the
 * reason in the source where the next reader is. Without this the ratchet can
 * never reach zero, and a floor nobody can clear is a floor people stop
 * lowering.
 *
 * The reason is REQUIRED: a bare marker is ignored, because "exempt" with no
 * "why" is indistinguishable from a string somebody could not be bothered to
 * wrap. Exemptions are read from the ORIGINAL source rather than the masked
 * copy — they live in comments, which masking removes — and that ordering is
 * the same trap `audit:retro` sprang in row 290, where a marker written above
 * its line was deleted before it could be read.
 *
 * It reports FILES and LINES, not a translation. Wrapping a string is a
 * judgement about what the sentence is for — a field label is a control's
 * name, an eyebrow is metadata — and this script has no opinion about that.
 *
 * ## The figure is a FLOOR, not a count
 *
 * The TEXT rule requires the capture to sit on ONE line, so JSX text broken
 * across lines is invisible to it:
 *
 *     <Link …>
 *       Back to the map
 *     </Link>
 *
 * That string is real, member-facing, and was untranslated in `MmmMissing`
 * for as long as the component existed — found by reading the file, not by
 * running this. Anyone quoting the number should say "at least". Teaching the
 * scanner to span lines is worth doing and will RAISE the count, which is why
 * it has not been folded into a pass that is also paying the count down: two
 * moving numbers in one change make both unreadable.
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
import { exemptLines } from './lib/exempt-lines.mjs';

/* `--roots=` overrides the scanned directories. It exists so a test can point
   the script at a scratch directory instead of writing a probe file into
   `src/` — which is a tree other suites walk, and a probe that lives there
   even briefly fails them under parallel test execution. Measured: it broke
   `wiring-guards.test.ts`. */
const rootsArg = process.argv.find((arg) => arg.startsWith('--roots='));
const ROOTS = rootsArg
  ? rootsArg.slice('--roots='.length).split(',').filter(Boolean)
  : ['src/app/app', 'src/components'];
const SKIP_DIRS = new Set(['admin', '__tests__', 'ds']);
/* Tests, and the admin console wherever it lives. `AdminAdsClient` sits in
   `src/components/` rather than `src/components/admin/`, and the console is
   deliberately English — the same call the dictionaries make by leaving every
   `admin*` namespace untranslated. Excluded by NAME as well as by directory,
   because one file in the wrong folder would otherwise put admin strings in a
   member-facing count. */
const SKIP_FILES = /\.(test|spec)\.tsx?$|(^|\/)Admin[A-Z][^/]*\.tsx$/;

/** `i18n-exempt: <reason>` — the reason is required, see the header. */
const EXEMPT = /i18n-exempt:\s*\S/i;

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
  /* A bare domain is a brand constant, not prose. `ihype.org` is the ONLY
     domain this product may name (CLAUDE.md), so flagging it would invite
     exactly the change that rule forbids. */
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(text)) return false;
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

/**
 * The `>` that opened this capture was part of an operator, so what follows is
 * source, not JSX text.
 *
 * `() => Promise<void>` reads as ">Promise<" to a bracket-only scan: the arrow
 * supplies the opening `>` and the generic supplies the closing `<`. That put
 * the word **"Promise"** in the list three times, and `"void; selected:
 * ReadonlySet"` and `"r._count._all"` beside it — findings that teach a reader
 * the list is noise, which is the failure this script's own header warns about.
 *
 * `CODE_FRAGMENT` could not catch these: it inspects the captured text, and
 * these captures are innocent-looking words. The operator is in the character
 * BEFORE the match, so that is where the test belongs.
 */
function openedByOperator(line, index) {
  /* Only `=`. `>=` puts the `=` INSIDE the capture, where `CODE_FRAGMENT`
     already catches it, and no other operator ends in `>`. Widening this set
     is a trap: including `<` would suppress every `<>fragment</>` in the
     codebase, silently, and the script would report a triumphant drop. */
  return index > 0 && line[index - 1] === '=';
}

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
    /* Read from the UNMASKED source: the marker lives in a comment, and
       masking is what removes comments.

       A marker exempts its own line and THE FIRST LINE OF CODE AFTER THE
       COMMENT IT SITS IN. Walking upward from the string instead does not
       work, and both wrong versions of that were written before this one: a
       one-line lookback misses a two-line reason, and a "contiguous comment
       block" walk misses it too, because only the FIRST line of a JSX
       comment block starts with a comment token — its continuation lines
       start with whatever word the sentence reached. Scanning forward from
       the marker has no such edge: a block comment ends where its closing
       delimiter says it does. */
    const rawLines = source.split('\n');
    /* This rule was wrong twice on the way in and now lives in
       `scripts/lib/exempt-lines.mjs`, because a second scanner rewrote it by
       hand and reproduced the first bug immediately. */
    const exempt = exemptLines(source, EXEMPT);
    const rel = relative(process.cwd(), file);

    lines.forEach((line, i) => {
      if (exempt(i)) return;
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
        if (openedByOperator(line, m.index)) continue;
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
