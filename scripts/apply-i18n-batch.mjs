#!/usr/bin/env node
// Merges a batch of translations into the locale dictionaries.
//
// A batch file is { locale: { key: translation, ... }, ... }. English is not
// included in a batch — en.json is filled from the source fallbacks by
// migrate-i18n-dictionaries.mjs.
//
// Safety rules, because there is no budget to redo this work:
//   - never overwrites an existing key (report it instead and leave it alone)
//   - refuses any key not actually called in the source tree (catches typos
//     that would otherwise sit dead in a dictionary forever)
//   - refuses empty translations and ones identical to the English fallback
//     (usually means a string was skipped rather than translated)
//   - writes keys sorted, so diffs stay reviewable
//   - single serial writer per file, as the handoff requires
//
// Usage:
//   node scripts/apply-i18n-batch.mjs <batch.json> --dry-run
//   node scripts/apply-i18n-batch.mjs <batch.json> --apply

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DICT_DIR = 'src/lib/i18n/dictionaries';
const [batchPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const apply = process.argv.includes('--apply');

if (!batchPath || (!apply && !process.argv.includes('--dry-run'))) {
  console.error('Usage: apply-i18n-batch.mjs <batch.json> (--dry-run | --apply)');
  process.exit(1);
}

// Per-locale writing systems. A translation containing characters from a
// script its language never uses is almost always a corrupted generation —
// a stray glyph substituted mid-word. It reads as a plausible typo to anyone
// who doesn't know the language and is effectively invisible in review.
//
// This is not hypothetical: an Arabic string here once came through as
// "لا يمкан التراجع" — Cyrillic к/а/н spliced into the middle of the Arabic
// word يمكن. Latin script is allowed everywhere, since brand terms (iHYPE,
// HYPE, DJ, QR, DELETE) and placeholders legitimately stay in Latin.
const SCRIPTS = {
  cyrillic: /[Ѐ-ӿ]/,
  arabic: /[؀-ۿ]/,
  devanagari: /[ऀ-ॿ]/,
  cjk: /[一-鿿]/,
  kana: /[぀-ヿ]/,
  hangul: /[가-힯]/,
};

const ALLOWED_SCRIPTS = {
  es: [], fr: [], pt: [], de: [], it: [],
  ru: ['cyrillic'],
  ar: ['arabic'],
  hi: ['devanagari'],
  ja: ['cjk', 'kana'],
  ko: ['hangul', 'cjk'],
  zh: ['cjk'],
};

const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const english = JSON.parse(
  execFileSync('node', ['scripts/extract-i18n-keys.mjs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
);

let totalAdded = 0;
const problems = [];

for (const [locale, entries] of Object.entries(batch)) {
  const path = join(DICT_DIR, `${locale}.json`);
  let dict;
  try {
    dict = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    problems.push(`unknown locale "${locale}" (no ${path})`);
    continue;
  }

  const before = Object.keys(dict).length;
  let added = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(entries)) {
    if (!(key in english)) {
      problems.push(`[${locale}] ${key} — not called anywhere in src/, refusing`);
      skipped++;
      continue;
    }
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`[${locale}] ${key} — empty translation, refusing`);
      skipped++;
      continue;
    }
    if (key in dict) {
      problems.push(`[${locale}] ${key} — already present, left unchanged`);
      skipped++;
      continue;
    }
    // Refuse, don't warn: a stray script means the string is corrupted, and
    // nobody reviewing a language they don't read would catch it later.
    const allowed = ALLOWED_SCRIPTS[locale] ?? [];
    const stray = Object.entries(SCRIPTS)
      .filter(([name, re]) => !allowed.includes(name) && re.test(value))
      .map(([name]) => name);
    if (stray.length > 0) {
      problems.push(`[${locale}] ${key} — contains ${stray.join('/')} characters, refusing: ${JSON.stringify(value)}`);
      skipped++;
      continue;
    }
    // Identical to English is legitimate for brand terms and loanwords
    // (e.g. "DMCA", "iHYPE Radio", "Seed"), so warn rather than refuse.
    if (value === english[key] && !/^[A-Za-z0-9 .·+—-]+$/.test(value)) {
      problems.push(`[${locale}] ${key} — identical to English, check it was translated`);
    }
    dict[key] = value;
    added++;
  }

  const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
  if (apply) writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);

  totalAdded += added;
  console.log(`${locale.padEnd(4)} ${String(before).padStart(5)} -> ${String(before + added).padStart(5)}  (+${added}, skipped ${skipped})`);
}

console.log(`\n${apply ? 'APPLIED' : 'DRY RUN'} — ${totalAdded} translations across ${Object.keys(batch).length} locales`);

if (problems.length > 0) {
  console.log(`\n${problems.length} note(s):`);
  for (const p of problems.slice(0, 30)) console.log(`  ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
}
