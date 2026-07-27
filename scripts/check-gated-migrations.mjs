#!/usr/bin/env node
// Enforces the gated-migration convention.
//
// Background: three migrations in this repo have carried "DO NOT APPLY BLIND"
// / "VERIFY BEFORE APPLYING" headers describing a manual review step. None of
// them ever had one. `.github/workflows/deploy-production.yml` runs
// `prisma migrate deploy` on every push to main, so any migration that reaches
// main is applied to production automatically — the comments were documentation
// that read like a control. Both drop migrations were applied that way.
//
// This makes the marker real: a migration carrying a gate marker cannot sit in
// prisma/migrations/ (the directory Prisma applies). It lives in
// prisma/migrations-pending/ until a human has done the verification and moves
// it across in its own commit. Moving the directory is the approval.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'prisma/migrations';
const PENDING_DIR = 'prisma/migrations-pending';

// Matched case-insensitively against each migration.sql. Keep the existing
// phrasings working so an author who writes the obvious thing is still caught.
const GATE_MARKERS = [
  '@gated',
  'do not apply blind',
  'verify before applying',
  'not safe to apply blind',
];

// Grandfathered. These three carry gate markers and are already applied to
// production, so they are exactly what this check exists to prevent — but they
// cannot be fixed in place: Prisma records a checksum of every applied
// migration in _prisma_migrations and `migrate deploy` aborts with a checksum
// mismatch if the file changes afterwards. Editing them, even to correct a
// comment, would block every future production deploy.
//
// Their headers are therefore wrong on purpose and left alone. The accurate
// history is in prisma/migrations-pending/README.md and CLAUDE.md. Do not add
// to this list — a new entry means a gated migration shipped.
const LEGACY_APPLIED = new Set([
  '20260714020000_drop_ad_submission',
  '20260714050000_drop_ad_image_url',
  '20260727120000_enable_rls_all_tables',
]);

function migrationDirs(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

const offenders = [];

for (const name of migrationDirs(MIGRATIONS_DIR)) {
  if (LEGACY_APPLIED.has(name)) continue;

  const sqlPath = join(MIGRATIONS_DIR, name, 'migration.sql');
  if (!existsSync(sqlPath)) continue;

  const sql = readFileSync(sqlPath, 'utf8');
  // Only the header comment block gates. A marker appearing further down (for
  // example inside a checklist that explains the convention) is not a gate.
  const header = sql.split(/^\s*[^-\s]/m)[0].toLowerCase();
  const hit = GATE_MARKERS.find((marker) => header.includes(marker));
  if (hit) offenders.push({ name, marker: hit });
}

if (offenders.length > 0) {
  console.error('\nGated migration found in the directory Prisma applies.\n');
  for (const { name, marker } of offenders) {
    console.error(`  ${MIGRATIONS_DIR}/${name}/migration.sql  (marker: "${marker}")`);
  }
  console.error(`
A migration marked as gated must NOT sit in ${MIGRATIONS_DIR}/. Everything in
that directory is applied to production automatically by
.github/workflows/deploy-production.yml the moment it reaches main — a comment
asking for review does not stop it.

Do one of:

  1. Park it until it has been verified:
       git mv ${MIGRATIONS_DIR}/<name> ${PENDING_DIR}/<name>
     Then apply it deliberately later by moving it back in its own commit,
     once the checklist in its header has actually been carried out.

  2. If the verification is already done and it is safe to ship, remove the
     gate marker from the header and say what was checked and by whom.

See ${PENDING_DIR}/README.md.
`);
  process.exit(1);
}

const pending = migrationDirs(PENDING_DIR).filter((name) => name !== 'README.md');
if (pending.length > 0) {
  console.log(`Gated migration check passed (${pending.length} parked in ${PENDING_DIR}/: ${pending.join(', ')}).`);
} else {
  console.log('Gated migration check passed.');
}
