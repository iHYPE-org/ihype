#!/usr/bin/env tsx
/**
 * Re-render the feature-health board from a saved walk report.
 *
 * The walk prints this board itself at the end of a run. This exists for the
 * two cases where that is not enough:
 *
 *   * CI wants the board in the job summary, and re-running the walk to get it
 *     would drive the product a second time — twenty minutes, and a second set
 *     of rows in the scratch database.
 *   * Someone wants yesterday's board without yesterday's worker.
 *
 * It renders and NEVER re-measures, so it cannot disagree with the run it is
 * describing. Same exit rule as the walk: non-zero only for BROKEN.
 *
 * Usage:
 *   npm run feature:health -- nightly-walk-report.json
 *   npm run feature:health -- nightly-walk-report.json --markdown
 */
import { readFileSync } from 'node:fs';

import { exitCodeFor, renderBoard, rollUp, type ItemResult } from '../src/lib/feature-health';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const markdown = args.includes('--markdown');

if (!file) {
  console.error('Usage: npm run feature:health -- <walk-report.json> [--markdown]');
  process.exit(2);
}

let parsed: { at?: string; target?: string; rows?: ItemResult[] };
try {
  parsed = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`Could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const rows = parsed.rows ?? [];
if (rows.length === 0) {
  /* An empty report is not a healthy product. Every covered journey would roll
     up to UNPROVEN and the board would look merely quiet, so refuse instead —
     the same reason `measure-layout` rejects a capture with too few boxes. */
  console.error(`${file} contains no item results. A walk that recorded nothing is not a pass.`);
  process.exit(2);
}

const health = rollUp(rows);
const board = renderBoard(health);

if (markdown) {
  console.log('## Feature health');
  console.log('');
  console.log('```');
  console.log(board.trimEnd());
  console.log('```');
  if (parsed.at) console.log(`\n_Measured ${parsed.at} against ${parsed.target ?? 'an unnamed target'}._`);
} else {
  console.log(board);
}

process.exit(exitCodeFor(health));
