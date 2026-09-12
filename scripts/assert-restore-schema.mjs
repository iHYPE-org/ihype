#!/usr/bin/env node

/*
  The restore drill's third check: does the restored database carry the schema
  this checkout expects?

  `verify-restored-backup.mjs` proves the rows and the critical columns are
  there. What it cannot know is whether the dump is CURRENT: a backup taken
  before last night's migration merged restores perfectly and is still one
  schema behind the code that would run against it. That gap is normal for a
  few hours and a finding after a few days, so the rule is a window rather than
  equality:

    - the restore may be BEHIND this checkout by at most MAX_BEHIND migrations
      (the dump ran before the merge — expected, briefly);
    - it may never be AHEAD (a dump with migrations this checkout does not
      have means the drill restored something other than production, or the
      checkout is not `main`).

  Reads the verifier's JSON (`--report=<file>`) and `prisma/migrations/`, and
  nothing else. Exported as a function so the unit suite can pin the rule.
*/

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_BEHIND = 3;

/**
 * @param {{ restored: number; latestRestored: string | null; expected: string[] }} input
 *   `expected` is the migration directory list of this checkout, sorted.
 * @returns {{ ok: boolean; behind: number; message: string }}
 */
export function assessRestoreSchema({ restored, latestRestored, expected }) {
  const total = expected.length;
  if (!Number.isInteger(restored) || restored < 1) {
    return { ok: false, behind: total, message: `the restore reports ${restored} completed migrations — nothing was restored` };
  }
  const behind = total - restored;
  if (behind < 0) {
    return { ok: false, behind, message: `the restore carries ${restored} migrations and this checkout has ${total}: the dump is AHEAD of the code, so it is not a dump of what this code runs against` };
  }
  if (behind > MAX_BEHIND) {
    return { ok: false, behind, message: `the restore is ${behind} migrations behind this checkout (latest restored: ${latestRestored ?? 'unknown'}) — the newest dump is stale, or the backup workflow has not run since those merged` };
  }
  if (latestRestored && !expected.includes(latestRestored)) {
    return { ok: false, behind, message: `the restore's latest migration ${latestRestored} is not in prisma/migrations/ — the dump came from a different schema history` };
  }
  return {
    ok: true,
    behind,
    message: behind === 0
      ? `schema current: ${restored} migrations, matching this checkout`
      : `schema ${behind} behind this checkout (${restored} of ${total}), inside the ${MAX_BEHIND}-migration window`,
  };
}

/*
  PRISMA'S RULE, NOT OURS, AND THE DIFFERENCE FAILED THE DRILL.

  This used to keep only directories matching /^\d{14}_/ — a shape invented
  here, never asserted by Prisma. Prisma Migrate counts a directory as a
  migration when it holds a `migration.sql`, whatever the directory is called,
  and this repository has four that a 14-digit rule throws away: `0001_init`
  and three `20260612`/`20260613_*` names carrying an 8-digit date. All four
  are real, all four are long applied, all four are rows in production's
  `_prisma_migrations`.

  So the count read 127 against a restore of 131 and the drill reported the
  dump as AHEAD of the code — the one direction this check treats as fatal,
  on the first run where the restore had actually worked. A second copy of
  "what counts as a migration" drifted from the authority, and the failure
  pointed at the backup rather than at the copy.

  Read the directory the way the tool that writes it does.
*/
export function migrationDirectories(root = 'prisma/migrations') {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'migration.sql')))
    .map((entry) => entry.name)
    .sort();
}

function main() {
  const reportArg = process.argv.find((a) => a.startsWith('--report='));
  if (!reportArg) {
    console.error('Usage: node scripts/assert-restore-schema.mjs --report=<verify:restore JSON>');
    process.exit(2);
  }
  const raw = readFileSync(reportArg.slice('--report='.length), 'utf8');
  /* The verifier prints one JSON document; `tee` may have put a trailing
     newline after it. Parse the last object on the stream. */
  const start = raw.indexOf('{');
  if (start < 0) {
    console.error('The report holds no JSON object.');
    process.exit(2);
  }
  const report = JSON.parse(raw.slice(start));
  const verdict = assessRestoreSchema({
    restored: Number(report?.migrations?.count),
    latestRestored: typeof report?.migrations?.latest === 'string' ? report.migrations.latest : null,
    expected: migrationDirectories(),
  });
  console.log(`${verdict.ok ? 'OK' : 'FAILED'} — ${verdict.message}`);
  process.exit(verdict.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
