import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A DESTRUCTIVE MIGRATION MUST RECORD A COUNT FOR EVERY THING IT DROPS.
 *
 * `prisma/migrations-pending/README.md` describes the workflow: a drop is
 * parked, its header names the exact query to run against production, somebody
 * runs it, the NUMBERS go into the header, and only then does the file move
 * across. The numbers rather than a verdict, because "verified, all zero" is
 * unfalsifiable a week later and the counts are not.
 *
 * WHAT THIS GUARDS IS THE STEP BETWEEN, and it is the one with no other check
 * on it: whoever runs the query can run a DIFFERENT query. On 2026-09-15 that
 * is exactly what happened here — the header for
 * `20260914180000_drop_columns_nothing_reads` asks for eight counts, a
 * hand-rewritten version of it asked for seven, and the answer came back all
 * zero. **A seven-of-eight answer reads precisely like an eight-of-eight one.**
 * The omitted column was `SocialPost.postedAt`; had it held rows, nothing
 * anywhere would have said so before the drop.
 *
 * So: for every migration whose header records a production run, every
 * identifier its SQL drops must appear in that header. The recorded block is
 * prose and the drops are code, and the direction matters — identifiers are
 * extracted from the SQL and looked for in the prose, never the reverse.
 *
 * COMMENTS ARE STRIPPED BEFORE THE DROPS ARE READ. The header quotes the
 * example query, which names every column in a `SELECT count(*) FROM "User"
 * WHERE "passwordHash" IS NOT NULL` line — so a scan that did not separate
 * comment from statement would find its own documentation and pass over a
 * migration that drops something the header never mentions. That is the
 * scanner-reads-its-own-prose trap this repository has now recorded five
 * times; `mask-comments.mjs` exists for the JavaScript version of it.
 *
 * Scoped to migrations carrying the recorded-run marker, so it says nothing
 * about the ~130 historical migrations written before the workflow existed.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma/migrations');

/** The marker the workflow writes when the counts have actually been read. */
const RECORDED_RUN = /RUN \d{4}-\d{2}-\d{2} against production/;

type Migration = { name: string; header: string; statements: string };

function readMigrations(): Migration[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(MIGRATIONS_DIR, entry.name, 'migration.sql');
      const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
      return {
        name: entry.name,
        /* Comment lines only — where the recorded counts live. */
        header: lines.filter((line) => line.trimStart().startsWith('--')).join('\n'),
        /* Statement lines only — where the drops live. Keeping these apart is
           the whole discipline; see the docstring. */
        statements: lines.filter((line) => !line.trimStart().startsWith('--')).join('\n'),
      };
    });
}

/** Every table and column the statements actually drop, as written. */
function droppedIdentifiers(statements: string): string[] {
  const out: string[] = [];
  for (const match of statements.matchAll(/ALTER TABLE\s+"([^"]+)"[\s\S]*?DROP COLUMN(?:\s+IF EXISTS)?\s+"([^"]+)"/gi)) {
    out.push(`${match[1]}.${match[2]}`);
  }
  for (const match of statements.matchAll(/DROP TABLE(?:\s+IF EXISTS)?\s+"([^"]+)"/gi)) {
    out.push(match[1]);
  }
  return [...new Set(out)];
}

describe('a destructive migration records a count for everything it drops', () => {
  const migrations = readMigrations();

  it('reads a plausible number of migrations, or the directory moved', () => {
    /* A zero here is what a renamed directory looks like, and it is also what
       a clean bill of health looks like. Refuse to tell them apart by luck. */
    expect(migrations.length).toBeGreaterThan(100);
  });

  const recorded = migrations.filter((m) => RECORDED_RUN.test(m.header));

  it('finds the migrations that carry a recorded production run', () => {
    expect(recorded.length).toBeGreaterThan(0);
  });

  for (const migration of recorded) {
    const dropped = droppedIdentifiers(migration.statements);
    if (dropped.length === 0) continue;

    it(`${migration.name} names every dropped identifier in its recorded counts`, () => {
      /* THE ANSWER, NOT THE QUESTION — and the first version of this test got
         that wrong in the most instructive way available. It searched the
         whole header, which still quotes the example query, and the example
         query names every column. So it passed the exact defect it was
         written for: counts recorded for seven of eight columns, with the
         eighth named only in the specification above them. Verified by
         reproducing that omission and watching the test stay
         green. The recorded block is everything from the marker onward, with
         the quoted specification's own lines removed wherever they sit; with
         that slice in place the same omission fails, and so does a drop
         appended with no count recorded for it at all. Both were driven
         rather than reasoned about — a guard proven in one direction only is
         the shape of the defect it exists to catch. */
      const recordedBlock = migration.header
        .slice(migration.header.search(RECORDED_RUN))
        .split('\n')
        .filter((line) => !/SELECT|count\(\*\)/i.test(line))
        .join('\n');

      /* The column alone, not `Table.column`: the recorded block is prose and
         writes `with_posted_at 0` beside the column name, not the qualified
         form. Matching on the bare identifier is the loose direction, which is
         right — this asks whether the record MENTIONS what the SQL destroys,
         and a record that mentions it while counting something else is a
         defect no string check can reach. */
      const missing = dropped.filter((id) => {
        const bare = id.includes('.') ? id.slice(id.indexOf('.') + 1) : id;
        return !recordedBlock.includes(bare);
      });
      expect(missing, `${migration.name} drops ${missing.join(', ')} and its recorded counts never name it`).toEqual([]);
    });
  }
});
