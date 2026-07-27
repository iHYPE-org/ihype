#!/usr/bin/env node
// Recovers existing translations for the new namespaced i18n keys.
//
// The problem: the sitewide wrap introduced ~3,972 namespaced keys
// (`aboutPage.ctaBody`) while the 12 shipped dictionaries hold ~1,400 keys in
// an older flat-abbreviation convention (`abCtaBody`). The two sets overlap by
// exactly 2 keys, so every wrapped string currently falls back to English in
// all 11 non-English locales — while ~17,600 already-translated strings sit
// unused in the dictionaries.
//
// The recovery: key names differ, but the *English text* is often identical.
// en.json maps oldKey -> English; the code gives newKey -> English fallback.
// Joining on that English text yields oldKey -> newKey, and the translation
// for newKey in locale L is simply L[oldKey].
//
// Confidence tiers:
//   exact      one old key has this English text -> copy its translation
//   agreeing   several old keys share the English text, but they all carry the
//              same translation in a given locale -> unambiguous in practice
//   conflict   several old keys share the English text and disagree in that
//              locale -> SKIPPED, needs a human. Reported, never guessed.
//
// Nothing is overwritten: a key already present in a dictionary is left alone.
// Old keys are retained (removing them is a separate decision).
//
// Usage:
//   node scripts/migrate-i18n-dictionaries.mjs --dry-run   # report only
//   node scripts/migrate-i18n-dictionaries.mjs --apply     # write files

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DICT_DIR = 'src/lib/i18n/dictionaries';
const EN = join(DICT_DIR, 'en.json');

const apply = process.argv.includes('--apply');
if (!apply && !process.argv.includes('--dry-run')) {
  console.error('Specify --dry-run or --apply.');
  process.exit(1);
}

// newKey -> English fallback, straight from the source tree.
const extracted = JSON.parse(
  execFileSync('node', ['scripts/extract-i18n-keys.mjs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
);

const en = JSON.parse(readFileSync(EN, 'utf8'));

// English text -> [oldKey, ...]
const byText = new Map();
for (const [k, v] of Object.entries(en)) {
  if (typeof v !== 'string') continue;
  const norm = v.trim();
  if (!byText.has(norm)) byText.set(norm, []);
  byText.get(norm).push(k);
}

// newKey -> [candidate old keys]
const candidates = new Map();
for (const [newKey, fallback] of Object.entries(extracted)) {
  if (typeof fallback !== 'string') continue;
  const hits = byText.get(fallback.trim());
  if (hits && hits.length > 0) candidates.set(newKey, hits);
}

const locales = readdirSync(DICT_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

const summary = {};
const conflicts = [];

for (const locale of locales) {
  const path = join(DICT_DIR, `${locale}.json`);
  const dict = JSON.parse(readFileSync(path, 'utf8'));
  const before = Object.keys(dict).length;

  let added = 0;
  let skippedPresent = 0;
  let skippedMissing = 0;
  let skippedConflict = 0;

  for (const [newKey, oldKeys] of candidates) {
    if (newKey in dict) { skippedPresent++; continue; }

    const values = oldKeys
      .map((ok) => dict[ok])
      .filter((v) => typeof v === 'string' && v.length > 0);

    if (values.length === 0) { skippedMissing++; continue; }

    const distinct = [...new Set(values)];
    if (distinct.length > 1) {
      skippedConflict++;
      if (locale !== 'en') {
        conflicts.push({ locale, newKey, oldKeys, options: distinct });
      }
      continue;
    }

    dict[newKey] = distinct[0];
    added++;
  }

  // Deterministic key order so diffs stay reviewable.
  const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));

  summary[locale] = { before, added, after: before + added, skippedPresent, skippedMissing, skippedConflict };

  if (apply) writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

console.log(apply ? 'APPLIED\n' : 'DRY RUN (no files written)\n');
console.log('locale   before   added    after   (skipped: present/no-translation/conflict)');
for (const [loc, s] of Object.entries(summary)) {
  console.log(
    `${loc.padEnd(8)} ${String(s.before).padStart(5)} ${String(s.added).padStart(7)} ${String(s.after).padStart(8)}   ` +
    `${s.skippedPresent}/${s.skippedMissing}/${s.skippedConflict}`,
  );
}

const totalAdded = Object.values(summary).reduce((n, s) => n + s.added, 0);
console.log(`\nTotal translations recovered: ${totalAdded}`);
console.log(`New keys with a candidate match: ${candidates.size} of ${Object.keys(extracted).length}`);

if (conflicts.length > 0) {
  const uniq = [...new Set(conflicts.map((c) => c.newKey))];
  console.log(`\n${uniq.length} key(s) skipped as ambiguous — same English, different translations. Needs a human:`);
  for (const c of conflicts.slice(0, 10)) {
    console.log(`  [${c.locale}] ${c.newKey}  <- ${c.oldKeys.join(', ')}`);
    for (const o of c.options) console.log(`      "${o}"`);
  }
  if (conflicts.length > 10) console.log(`  ...and ${conflicts.length - 10} more locale/key combinations`);
}
