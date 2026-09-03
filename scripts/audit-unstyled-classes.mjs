#!/usr/bin/env node
/**
 * Every class the app RENDERS that no stylesheet DEFINES.
 *
 * ## Why this exists
 *
 * `.mmm-player-range` sits on the full player's seek bar and volume control.
 * It was never defined in any stylesheet — `git log -S` finds it was never
 * even added — so both rendered as the browser's default blue track on a
 * walnut cabinet for as long as the player has existed. It was found by a
 * person looking at the screen and saying so.
 *
 * Nothing in CI could see it. A class name that resolves to no rule is not an
 * error in HTML, CSS, TypeScript or React: the element simply renders unstyled
 * and the build is green. `audit:shell` asks whether a class is NAMED right,
 * `audit:retro` whether it paints from tokens, `audit:css` whether two rules
 * collide — all three pass on markup wearing a class that does not exist.
 *
 * The first run found 105, including `/invite/[code]`'s `loading.tsx` and
 * `error.tsx` written entirely in TAILWIND UTILITIES — `flex items-center
 * justify-center min-h-[40vh]`, `animate-pulse text-sm text-gray-400` — in a
 * project that has never had Tailwind. Both states rendered as unstyled text
 * in the top-left corner.
 *
 * ## What counts as a definition
 *
 * Any `.class` selector in any `.css` file under `src/`, PLUS any inside a
 * `<style>` block embedded in a component — two shell components carry their
 * own stylesheet that way, and treating those as undefined would bury the real
 * findings under false ones.
 *
 * ## What this deliberately cannot see
 *
 * A class assembled at runtime (`` `mmm-${kind}-row` ``) is invisible to a
 * static scan, and a class read only by JavaScript or by a test selector is
 * reported here while being perfectly intentional. So this is a REPORT with a
 * ratchet, not a truth oracle: findings are read, not obeyed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src');
const CLASS_IDENT = /^-?[_a-zA-Z][\w-]*$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry);
    if (statSync(file).isDirectory()) walk(file, out);
    else out.push(file);
  }
  return out;
}

if (!existsSync(ROOT)) {
  console.error(`audit:unstyled: no ${ROOT} — run from the repository root. A missing scan root must break this script, never report a triumphant zero.`);
  process.exit(1);
}
const files = walk(ROOT);
const sheets = files.filter((f) => f.endsWith('.css'));
const sources = files.filter((f) => /\.tsx?$/.test(f));

let styleText = sheets.map((f) => readFileSync(f, 'utf8')).join('\n');
/* A component that injects a stylesheet usually does it as
   `<style>{styles}</style>` with `styles` a module-level template literal, so
   the tag's own contents are the four characters `{styles}` and NOT the CSS.
   Reading only between the tags is how the first version of this script
   reported all eighteen of AdvertiserRegisterForm's classes as unstyled when
   every one of them is defined ten lines below the markup — a false positive
   big enough to get the whole check ignored.
 
   So: if a file contains a <style> tag at all, every template literal in that
   file counts as a definition source. Over-collecting definitions can only
   HIDE a finding, never invent one, which is the right way for this to fail. */
for (const f of sources) {
  const src = readFileSync(f, 'utf8');
  if (!/<style[\s>]/.test(src)) continue;
  for (const m of src.matchAll(/`([^`]*)`/g)) {
    if (/\.[-\w]+[^{]*\{/.test(m[1])) styleText += `\n${m[1]}`;
  }
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styleText += `\n${m[1]}`;
}

const defined = new Set();
for (const m of styleText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1]);

const used = new Map();
for (const f of sources) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    for (const raw of (m[1] ?? m[2] ?? '').split(/\s+/)) {
      /* A template literal's conditional lands in this capture as fragments —
         `?`, `:`, `'secondary'}`, `===`. A real class is the CSS ident grammar
         and nothing else. */
      const cls = raw.trim();
      if (!CLASS_IDENT.test(cls)) continue;
      if (!used.has(cls)) used.set(cls, new Set());
      used.get(cls).add(path.relative(process.cwd(), f));
    }
  }
}

/* A directory rename or a changed attribute syntax must BREAK this script
   rather than report a triumphant zero — the same rule audit:mounts and
   audit:routes follow. */
if (defined.size === 0 || used.size === 0) {
  console.error(`audit:unstyled collected ${defined.size} definitions and ${used.size} rendered classes — one of them is zero, so it is reading nothing. Check the scan roots.`);
  process.exit(1);
}

const missing = [...used.entries()]
  .filter(([cls]) => !defined.has(cls))
  .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));

const maxArg = process.argv.find((a) => a.startsWith('--max='));
const max = maxArg ? Number(maxArg.split('=')[1]) : null;
const list = process.argv.includes('--list');

console.log(`\n  ${used.size} classes rendered · ${defined.size} defined · ${missing.length} rendered by markup and defined by nothing\n`);
for (const [cls, where] of (list ? missing : missing.slice(0, 25))) {
  console.log(`  ${cls.padEnd(32)} ${[...where].slice(0, 2).join(', ')}${where.size > 2 ? ` +${where.size - 2}` : ''}`);
}
if (!list && missing.length > 25) console.log(`  … ${missing.length - 25} more (run with --list)`);

if (max !== null && missing.length > max) {
  console.error(`\naudit:unstyled: ${missing.length} unstyled classes, budget ${max}. A class that resolves to no rule renders as an unstyled element and no other check can see it.`);
  process.exit(1);
}
console.log(max !== null ? `\n  Within the budget of ${max}.\n` : '\n  Advisory run — pass --max=N to ratchet.\n');
