#!/usr/bin/env node
// Extracts every t('key', 'English fallback') call in the source tree and
// emits a flat { key: fallback } JSON object — the source text translators
// need, and the shape the runtime actually looks up.
//
// Why this exists: the sitewide wrap introduced ~3,971 namespaced keys
// (`aboutPage.ctaBody`), while the 12 shipped dictionaries hold ~1,400 keys in
// an older flat-abbreviation convention (`abCtaBody`). The two sets overlap by
// exactly 2 keys, so today every wrapped string falls back to English in all
// 12 locales. Nothing is broken — `t(key, fallback)` returns the fallback —
// but the app is not actually multilingual yet.
//
// IMPORTANT for whoever adds translations: getT()/useI18n() do a FLAT lookup
// (`dict[key]`), not nested traversal. A key containing dots must be a single
// literal flat key:
//
//     { "aboutPage.ctaBody": "..." }        correct
//     { "aboutPage": { "ctaBody": "..." } } silently never matches
//
// Usage:
//   node scripts/extract-i18n-keys.mjs                  # write to stdout
//   node scripts/extract-i18n-keys.mjs --out en.json    # write to a file
//   node scripts/extract-i18n-keys.mjs --missing        # only keys absent from en.json
//
// Write dictionary files with a single serial writer. The handoff notes a real
// collision when parallel agents edited the same file at once.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const EN_DICT = 'src/lib/i18n/dictionaries/en.json';
const EXTS = new Set(['.ts', '.tsx']);

// t('key', 'fallback') / t("key", "fallback") — captures both quote styles and
// tolerates whitespace/newlines between the arguments. Template literals and
// non-literal fallbacks are intentionally skipped: they are not translatable
// as static text and need a human to restructure them.
const CALL = /\bt\(\s*(['"])([A-Za-z0-9_.\-]+)\1\s*,\s*(['"])((?:\\.|(?!\3)[^\\])*)\3\s*\)/g;
const NO_FALLBACK = /\bt\(\s*(['"])([A-Za-z0-9_.\-]+)\1\s*\)/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(full.slice(full.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

const keys = {};
const noFallback = new Set();
const conflicts = [];

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');

  for (const m of text.matchAll(CALL)) {
    const [, , key, , raw] = m;
    // Un-escape what the source escaped, so the dictionary holds real text.
    const value = raw.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');
    if (key in keys && keys[key] !== value) {
      conflicts.push({ key, existing: keys[key], found: value, file });
    }
    keys[key] = value;
  }

  for (const m of text.matchAll(NO_FALLBACK)) noFallback.add(m[2]);
}

const sorted = Object.fromEntries(Object.keys(keys).sort().map((k) => [k, keys[k]]));

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const onlyMissing = args.includes('--missing');

let result = sorted;

if (onlyMissing) {
  if (!existsSync(EN_DICT)) {
    console.error(`${EN_DICT} not found.`);
    process.exit(1);
  }
  const existing = JSON.parse(readFileSync(EN_DICT, 'utf8'));
  result = Object.fromEntries(Object.entries(sorted).filter(([k]) => !(k in existing)));
}

const json = `${JSON.stringify(result, null, 2)}\n`;

if (outIdx !== -1 && args[outIdx + 1]) {
  writeFileSync(args[outIdx + 1], json);
  console.error(`Wrote ${Object.keys(result).length} keys to ${args[outIdx + 1]}`);
} else {
  process.stdout.write(json);
}

// Diagnostics go to stderr so they never pollute piped JSON.
console.error(`\nExtracted ${Object.keys(sorted).length} keys with fallbacks.`);

if (noFallback.size > 0) {
  console.error(
    `\n${noFallback.size} t() call(s) have NO fallback — these render the raw key ` +
    `to the user if the key is missing from the dictionary:\n  ${[...noFallback].sort().join('\n  ')}`,
  );
}

if (conflicts.length > 0) {
  console.error(`\n${conflicts.length} key(s) used with DIFFERENT fallback text in different places:`);
  for (const c of conflicts.slice(0, 20)) {
    console.error(`  ${c.key}\n    "${c.existing}"\n    "${c.found}"  (${c.file})`);
  }
  if (conflicts.length > 20) console.error(`  ...and ${conflicts.length - 20} more`);
}
