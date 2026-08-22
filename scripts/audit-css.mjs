#!/usr/bin/env node
/**
 * CSS structural audit — the check that `audit:shell` structurally cannot do.
 *
 * `audit-shell-classes.mjs` asks "is this class named correctly and does it use
 * tokens". It cannot see the failure that actually shipped: a selector DEFINED
 * MORE THAN ONCE, where a later block silently overrides an earlier one.
 *
 * That is not hypothetical. `/login` and `/register` rendered a retired
 * two-column light-cream design for months because a "Scene-signal auth
 * journey" layer sat ~300 lines below the canonical `.authcard-*` block and
 * re-declared the same six selectors. Both blocks were valid CSS, nothing
 * errored, and the design simply never appeared. The class-name audit was
 * green the whole time. `.nav` was found stacked FOUR deep the same way.
 *
 * Two checks:
 *
 *   1. OVERRIDES — a selector redefined in the same cascade context where the
 *      later rule re-declares properties the earlier one set. Rules that set
 *      disjoint properties are normal layering and are NOT reported.
 *
 *   2. DEAD CLASSES — class selectors referenced by no source file. These are
 *      usually retired screens. Harmless on their own, but they are what a
 *      duplicate layer hides inside, and they ship to every visitor.
 *
 * GATING IS A RATCHET, NOT A CLIFF. 145 overrides already existed when this
 * was written, spread across surfaces that render correctly today only because
 * the right rule happens to come last. Fixing them all at once is a large
 * refactor with real regression risk, and blocking every merge until someone
 * does it would just get the check disabled. So CI passes `--max=<baseline>`:
 * the existing debt is tolerated, a NEW duplicate fails the build. Lower the
 * number as they get fixed; never raise it.
 *
 * Dead classes stay advisory — a class can legitimately be added by a library
 * or by markup this scan cannot see.
 *
 * Usage: npm run audit:css [-- --max=N] [-- --strict] [-- --dead] [-- --all]
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

const STRICT = process.argv.includes('--strict');
const SHOW_DEAD = process.argv.includes('--dead');
const SHOW_ALL = process.argv.includes('--all');
const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX = maxArg ? Number(maxArg.slice('--max='.length)) : null;

const CSS_FILES = globSync('src/**/*.css')
  .map((file) => file.replaceAll('\\', '/'))
  .sort();

/**
 * `mmm-primitives.css` is exempt from the OVERRIDE check by design: its entire
 * purpose is to alias many legacy class names onto one primitive, so the same
 * primitive intentionally appears in several grouped rules. See its header.
 */
const OVERRIDE_EXEMPT = new Set(['src/app/mmm-primitives.css']);

// MapLibre creates this DOM outside React, so these classes cannot appear in
// the source haystack even though the live map requires their CSS.
const RUNTIME_CLASSES = new Set([
  'maplibregl-canvas',
  'maplibregl-ctrl-attrib',
  'maplibregl-ctrl-logo',
]);

function stripComments(css) {
  // Preserve newlines so reported line numbers stay honest.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function parseRules(css) {
  const rules = [];
  const stack = [];
  let buf = '';
  let i = 0;
  const lineAt = (idx) => css.slice(0, idx).split('\n').length;

  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const head = buf.trim();
      buf = '';
      if (head.startsWith('@')) {
        stack.push(head.replace(/\s+/g, ' '));
      } else {
        let depth = 1;
        let j = i + 1;
        while (j < css.length && depth > 0) {
          if (css[j] === '{') depth += 1;
          else if (css[j] === '}') { depth -= 1; if (depth === 0) break; }
          j += 1;
        }
        const body = css.slice(i + 1, j);
        const props = [...body.matchAll(/(^|;)\s*([-a-zA-Z][-a-zA-Z0-9]*)\s*:/g)].map((m) => m[2].toLowerCase());
        const line = lineAt(i);
        const context = stack.join(' >> ') || '(top level)';
        const inKeyframes = stack.some((s) => /^@(-webkit-)?keyframes/i.test(s));
        if (!inKeyframes) {
          for (const sel of head.split(',')) {
            const s = sel.trim().replace(/\s+/g, ' ');
            if (s) rules.push({ selector: s, context, line, props: new Set(props) });
          }
        }
        i = j + 1;
        continue;
      }
    } else if (ch === '}') {
      if (stack.length) stack.pop();
      buf = '';
    } else {
      buf += ch;
    }
    i += 1;
  }
  return rules;
}

function findOverrides(rules) {
  const byKey = new Map();
  for (const r of rules) {
    const key = `${r.context}||${r.selector}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  const out = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    for (let a = 0; a < group.length; a += 1) {
      for (let b = a + 1; b < group.length; b += 1) {
        // Same physical rule (comma-grouped selectors) is not a redefinition.
        if (group[a].line === group[b].line) continue;
        const overlap = [...group[b].props].filter((p) => group[a].props.has(p));
        if (!overlap.length) continue;
        const [context, selector] = key.split('||');
        out.push({ selector, context, earlier: group[a].line, later: group[b].line, overlap });
      }
    }
  }
  return out.sort((x, y) => y.overlap.length - x.overlap.length);
}

function buildHaystack() {
  const src = globSync(['src/**/*.{tsx,ts,md,mdx}', 'e2e/**/*.{tsx,ts,md,mdx}']);
  const pub = globSync('public/**/*.{js,html,json}');
  return [...src, ...pub]
    .map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } })
    .join('\n');
}

/**
 * A comment sitting INSIDE a selector, which silently changes what it matches.
 *
 * A comment is whitespace to a CSS parser, so this:
 *
 *   .a  /* why *\/  .a > .b { … }
 *
 * is not `.a > .b` with a note attached — it is `.a .a > .b`, a descendant
 * combinator, and if no `.a` is ever nested inside another `.a` the rule never
 * applies to anything. Valid CSS, no error, nothing for the override check to
 * see, and no dead class either, because the class names are all real.
 *
 * That is not hypothetical: `.mmm-music-controls > .mmm-search-wrap` shipped
 * this way, so the rule that stops a 300px flex-basis becoming 300px of HEIGHT
 * in a column never ran. The result was 273px of empty space between the search
 * bar on MUSIC and the first card under it, with the deck pushed below the fold
 * — reported from a phone as "space between search and content too wide
 * requires scroll". The comment explaining the fix was the reason the fix was
 * absent.
 *
 * Detected on the RAW source, before comments are stripped: a `/*` whose line
 * has selector-ish text before it (no `;`, `{`, `}` or `,` terminator) and which
 * does not close on that same line has swallowed a newline into a selector.
 */
function commentsInsideSelectors(raw) {
  const found = [];
  const lines = raw.split('\n');
  let inComment = false;
  for (const [index, line] of lines.entries()) {
    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }
    const at = line.indexOf('/*');
    if (at < 0) continue;
    const closes = line.indexOf('*/', at) >= 0;
    if (!closes) inComment = true;
    const before = line.slice(0, at).trim();
    /* Terminated text is a declaration or the end of a block, and a comment
       after it is ordinary documentation. Bare text is a selector fragment. */
    if (!before || /[;{},]$/.test(before)) continue;
    found.push({ line: index + 1, before: before.slice(0, 70) });
  }
  return found;
}

let overrideCount = 0;
let deadCount = 0;
let splitSelectorCount = 0;
const haystack = buildHaystack();

for (const file of CSS_FILES) {
  const raw = readFileSync(file, 'utf8');
  const css = stripComments(raw);
  const rules = parseRules(css);

  const split = commentsInsideSelectors(raw);
  if (split.length) {
    splitSelectorCount += split.length;
    console.log(`\n${file} — ${split.length} comment(s) inside a selector:`);
    for (const s of split) console.log(`     line ${s.line}: after \`${s.before}\``);
  }

  if (!OVERRIDE_EXEMPT.has(file)) {
    const overrides = findOverrides(rules);
    if (overrides.length) {
      console.log(`\n${file} — ${overrides.length} overriding redefinition(s):`);
      const reportedOverrides = SHOW_ALL ? overrides : overrides.slice(0, 20);
      for (const o of reportedOverrides) {
        console.log(`  ${o.selector}  [${o.context}]`);
        console.log(`     line ${o.earlier} is overridden by line ${o.later} — re-declares ${o.overlap.length}: ${o.overlap.slice(0, 6).join(', ')}${o.overlap.length > 6 ? ' …' : ''}`);
      }
      if (!SHOW_ALL && overrides.length > 20) console.log(`  … ${overrides.length - 20} more`);
      overrideCount += overrides.length;
    }
  }

  const classes = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][-\w]*)/g)) classes.add(m[1]);
  const dead = [...classes]
    .filter((c) => !RUNTIME_CLASSES.has(c) && !haystack.includes(c))
    .sort();
  if (dead.length) {
    deadCount += dead.length;
    console.log(`\n${file} — ${dead.length} class(es) referenced by no source file${SHOW_DEAD ? ':' : ' (run with --dead to list)'}`);
    if (SHOW_DEAD) for (const d of dead) console.log(`     .${d}`);
  }
}

console.log('\n' + '─'.repeat(64));
console.log(`overriding redefinitions: ${overrideCount}   comments inside selectors: ${splitSelectorCount}   dead classes: ${deadCount} (advisory)`);

/* Unconditional, and not part of the --max ratchet: this is never pre-existing
   debt to be paid down, it is a rule that does not do what it says. */
if (splitSelectorCount > 0) {
  console.error(
    `\nFAIL: ${splitSelectorCount} comment(s) sit inside a selector, joining it to the next one.\n` +
    'The rule matches something other than what it appears to. Move the comment\n' +
    'above the whole selector.',
  );
  process.exit(1);
}

const FAIL_MSG =
  '\nA selector is defined more than once and the later block wins.\n' +
  'This is how the auth screens rendered a retired design for months.\n' +
  'Fix the ORIGINAL rule; do not add another block below it.';

if (overrideCount === 0) {
  console.log('No selector is silently overridden by a later block.');
  if (MAX !== null && MAX > 0) {
    console.log(`Baseline is ${MAX} — all cleared. Lower --max in CI to 0 to keep it that way.`);
  }
} else if (MAX !== null) {
  if (overrideCount > MAX) {
    console.error(`\nFAIL: ${overrideCount} overriding redefinition(s), above the agreed baseline of ${MAX}.${FAIL_MSG}`);
    process.exit(1);
  }
  console.log(`Within the baseline of ${MAX}. This is pre-existing debt, not a clean bill of health.`);
  if (overrideCount < MAX) {
    console.log(`It is now ${overrideCount} — lower --max in .github/workflows/ci.yml to ${overrideCount} to lock the gain in.`);
  }
} else if (STRICT) {
  console.error(`\nFAIL: ${overrideCount} overriding redefinition(s).${FAIL_MSG}`);
  process.exit(1);
}
