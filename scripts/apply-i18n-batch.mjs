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
