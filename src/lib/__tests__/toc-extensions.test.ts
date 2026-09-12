import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  extensionEntryLines,
  extensionOfTocLine,
  filterUnavailableExtensions,
  filterUnhostableSchemas,
  parseExtensionSchemas,
  schemaOfTocLine,
  schemasInToc,
} from '../../../scripts/lib/toc-extensions.mjs';

/**
 * The restore drill's extension filter.
 *
 * The nightly restore drill FAILED on both of the only two nights it had ever
 * run, on `extension "pg_cron" is not available` — production is Supabase and
 * the dump names four extensions a stock `postgres:17` has never heard of, so
 * `pg_restore --exit-on-error` stopped at the first one and nothing had ever
 * restored. The fix drops those entries from the table of contents.
 *
 * Three properties are worth a test rather than a reading.
 *
 * The first is the one that was got wrong: an extension occupies TWO TOC
 * entries and only the first says EXTENSION in the type column, so a filter
 * written from the obvious shape leaves `COMMENT ON EXTENSION pg_cron`
 * behind and the restore dies one line later. The lines below are copied from
 * real `pg_restore --list` output, trailing space and all.
 *
 * The second came from the very next run, and is why "cannot host" has two
 * halves: with pg_cron skipped the drill died on `schema "stripe" does not
 * exist` from `CREATE EXTENSION … btree_gist WITH SCHEMA stripe`. btree_gist
 * is available everywhere — the SCHEMA is what the archive does not carry, and
 * an extension's TOC entry says `-` where its schema would go, so the schema
 * has to be read out of the archive's own SQL.
 *
 * The third is the safety property: skipping the PLATFORM's extensions keeps
 * a drill honest, and skipping the PRODUCT's would make it a lie. pg_trgm is
 * created by this repository's own migrations, so a target without it is a
 * failed restore — never a tidy one.
 */

/* Verbatim from `pg_restore --list` over an archive written by pg_dump 17. */
const REAL_TOC = [
  ';',
  '; Archive created at 2026-09-12 00:00:00 UTC',
  ';',
  '2; 3079 16385 EXTENSION - pg_trgm ',
  '3455; 0 0 COMMENT - EXTENSION pg_trgm',
  '4; 3079 16402 EXTENSION - pg_cron ',
  '3456; 0 0 COMMENT - EXTENSION pg_cron',
  '5; 3079 16500 EXTENSION - supabase_vault ',
  '3457; 0 0 COMMENT - EXTENSION supabase_vault',
  '6; 3079 16700 EXTENSION - btree_gist ',
  '3459; 0 0 COMMENT - EXTENSION btree_gist',
  '9; 2615 16800 SCHEMA - app postgres',
  '215; 1259 16600 TABLE public User postgres',
  '3458; 0 0 COMMENT - SCHEMA public postgres',
].join('\n');

describe('extensionOfTocLine', () => {
  it('recognises the CREATE entry', () => {
    expect(extensionOfTocLine('2; 3079 16385 EXTENSION - pg_trgm ')).toBe('pg_trgm');
  });

  it('recognises the COMMENT entry, which is the one a naive filter misses', () => {
    expect(extensionOfTocLine('3455; 0 0 COMMENT - EXTENSION pg_trgm')).toBe('pg_trgm');
  });

  it('does not claim a comment on something that is not an extension', () => {
    expect(extensionOfTocLine('3458; 0 0 COMMENT - SCHEMA public postgres')).toBeNull();
  });

  it('does not claim an ordinary object', () => {
    expect(extensionOfTocLine('215; 1259 16600 TABLE public User postgres')).toBeNull();
    expect(extensionOfTocLine('; Archive created at 2026-09-12 00:00:00 UTC')).toBeNull();
    expect(extensionOfTocLine('')).toBeNull();
  });
});

describe('extensionEntryLines and parseExtensionSchemas', () => {
  it('hands back only the CREATE entries, verbatim, for pg_restore to re-read', () => {
    expect(extensionEntryLines(REAL_TOC)).toEqual([
      '2; 3079 16385 EXTENSION - pg_trgm ',
      '4; 3079 16402 EXTENSION - pg_cron ',
      '5; 3079 16500 EXTENSION - supabase_vault ',
      '6; 3079 16700 EXTENSION - btree_gist ',
    ]);
  });

  it('reads each extension\'s schema out of the archive\'s own SQL', () => {
    /* Verbatim from `pg_restore --use-list=<extensions only> -f -`. */
    const sql = [
      "SELECT pg_catalog.set_config('search_path', '', false);",
      'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA stripe;',
      'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;',
    ].join('\n');
    expect(parseExtensionSchemas(sql)).toEqual(new Map([
      ['btree_gist', 'stripe'],
      ['pg_trgm', 'public'],
    ]));
  });

  it('names the schemas the archive creates for itself', () => {
    expect(schemasInToc(REAL_TOC)).toEqual(new Set(['app']));
  });
});

describe('filterUnavailableExtensions', () => {
  const available = new Set(['pg_trgm', 'citext', 'btree_gist']);
  const required = new Set(['pg_trgm']);
  const extensionSchemas = new Map([
    ['pg_trgm', 'public'],
    ['pg_cron', 'pg_catalog'],
    ['supabase_vault', 'vault'],
    ['btree_gist', 'stripe'],
  ]);
  const hostableSchemas = new Set(['public', 'pg_catalog', 'app']);
  const options = { availableExtensions: available, extensionSchemas, hostableSchemas, required };
  const names = (list: { name: string }[]) => list.map((entry) => entry.name).sort();

  it('drops BOTH entries of an extension the target does not provide', () => {
    const { keptLines, skipped } = filterUnavailableExtensions(REAL_TOC, options);
    expect(names(skipped)).toContain('pg_cron');
    expect(keptLines.some((line) => line.includes('pg_cron'))).toBe(false);
  });

  it('drops an AVAILABLE extension whose schema the archive does not restore', () => {
    const { keptLines, skipped } = filterUnavailableExtensions(REAL_TOC, options);
    const entry = skipped.find((row) => row.name === 'btree_gist');
    expect(entry, 'btree_gist is available everywhere; its schema is what is missing').toBeDefined();
    expect(entry!.reason).toContain('stripe');
    expect(keptLines.some((line) => line.includes('btree_gist'))).toBe(false);
  });

  it('says which of the two reasons applies, since the fixes differ', () => {
    const { skipped } = filterUnavailableExtensions(REAL_TOC, options);
    const reasons = Object.fromEntries(skipped.map((row) => [row.name, row.reason]));
    expect(reasons.pg_cron).toBe('the target does not provide it');
    expect(reasons.supabase_vault).toBe('the target does not provide it');
    expect(reasons.btree_gist).toContain('does not restore');
  });

  it('keeps every entry the target can host, including the header and the data', () => {
    const { keptLines } = filterUnavailableExtensions(REAL_TOC, options);
    expect(keptLines).toContain('2; 3079 16385 EXTENSION - pg_trgm ');
    expect(keptLines).toContain('3455; 0 0 COMMENT - EXTENSION pg_trgm');
    expect(keptLines).toContain('215; 1259 16600 TABLE public User postgres');
    expect(keptLines).toContain('9; 2615 16800 SCHEMA - app postgres');
    expect(keptLines[0]).toBe(';');
  });

  it('reports an APPLICATION extension the target lacks instead of skipping it', () => {
    const { skipped, missingRequired } = filterUnavailableExtensions(REAL_TOC, {
      ...options, availableExtensions: new Set(['citext']),
    });
    expect(names(missingRequired)).toEqual(['pg_trgm']);
    expect(names(skipped)).not.toContain('pg_trgm');
  });

  it('reports a required extension whose schema is missing, too', () => {
    const { missingRequired } = filterUnavailableExtensions(REAL_TOC, {
      ...options, hostableSchemas: new Set(['pg_catalog', 'app']),
    });
    expect(names(missingRequired)).toEqual(['pg_trgm']);
  });

  it('names each extension once however many entries it occupies', () => {
    const { skipped } = filterUnavailableExtensions(REAL_TOC, options);
    expect(names(skipped)).toEqual([...new Set(names(skipped))]);
  });

  it('judges on availability alone when no schema map could be read', () => {
    /* Reading the archive's SQL is best effort: with no map the filter falls
       back to where it started, which is less complete and never wrong. */
    const { skipped } = filterUnavailableExtensions(REAL_TOC, {
      availableExtensions: available, required,
    });
    expect(names(skipped)).toEqual(['pg_cron', 'supabase_vault']);
  });

  it('skips nothing when the target can host everything', () => {
    const { keptLines, skipped, missingRequired } = filterUnavailableExtensions(REAL_TOC, {
      ...options,
      availableExtensions: new Set(['pg_trgm', 'pg_cron', 'supabase_vault', 'btree_gist']),
      hostableSchemas: new Set(['public', 'pg_catalog', 'app', 'vault', 'stripe']),
    });
    expect(skipped).toEqual([]);
    expect(missingRequired).toEqual([]);
    expect(keptLines).toHaveLength(REAL_TOC.split('\n').length);
  });
});

describe('the restore script still uses the filter the way these tests describe', () => {
  const script = readFileSync('scripts/restore-backup.mjs', 'utf8');

  it('declares pg_trgm required, so a target without it fails rather than skips', () => {
    expect(script).toMatch(/REQUIRED_EXTENSIONS = new Set\(\['pg_trgm'\]\)/);
    expect(script).toMatch(/if \(missingRequired\.length\) \{/);
  });

  it('reads the target for what it can host rather than hardcoding a skip list', () => {
    expect(script).toContain('SELECT name FROM pg_available_extensions');
  });

  it("reads each extension's schema out of the archive rather than guessing", () => {
    expect(script).toContain('extensionEntryLines(toc.output)');
    expect(script).toContain('parseExtensionSchemas(');
    /* The hostable set was `schemasInToc` plus a hardcoded `public` and
       `pg_catalog`; it reads the target's own `pg_namespace` now, because a
       hardcoded list is the second copy of a fact this module exists to
       avoid — `information_schema` and whatever a platform added are on every
       database too. Pinned here so the assertion moves with the mechanism. */
    expect(script).toContain('schemasInToc(toc.output)');
    expect(script).toContain('SELECT nspname FROM pg_namespace');
  });

  it('keeps --exit-on-error, which is the whole point of filtering beforehand', () => {
    expect(script).toContain("'--exit-on-error'");
  });

  it('passes the surviving entries through --use-list', () => {
    expect(script).toContain("'--use-list'");
  });
});

/**
 * The fourth blocker, and the one the code predicted in writing.
 *
 * Skipping `CREATE EXTENSION pg_cron` leaves the extension's own configuration
 * table behind: pg_cron registers `cron.job` with `pg_extension_config_dump`,
 * so pg_dump emits its rows as ordinary table data while emitting no
 * `CREATE SCHEMA cron` — the schema is an extension member. The fourth drill
 * run died on `ERROR: schema "cron" does not exist`.
 *
 * These lines are copied from a `pg_restore --list` of an archive built to
 * that exact shape: an extension that creates its own schema, registers a
 * config table, and is then made unavailable to the target.
 */
const ORPHANED_TOC = [
  '5; 3079 19139 EXTENSION - fakecron ',
  '3738; 0 0 COMMENT - EXTENSION fakecron ',
  '3578; 0 19141 TABLE DATA fakecron job postgres',
  '215; 1259 16600 TABLE public User postgres',
  '3579; 0 16600 TABLE DATA public User postgres',
  '9; 2615 16800 SCHEMA - app postgres',
  '222; 1259 19122 TABLE app widget postgres',
].join('\n');

describe('schemaOfTocLine', () => {
  it('reads the schema an entry belongs to', () => {
    expect(schemaOfTocLine('3578; 0 19141 TABLE DATA fakecron job postgres')).toBe('fakecron');
    expect(schemaOfTocLine('215; 1259 16600 TABLE public User postgres')).toBe('public');
  });

  it('is null for an entry with no schema', () => {
    /* An extension's entry carries a literal `-` where a schema would go,
       which is why the schema had to be read out of the archive's SQL. */
    expect(schemaOfTocLine('5; 3079 19139 EXTENSION - fakecron ')).toBeNull();
    expect(schemaOfTocLine('3738; 0 0 COMMENT - EXTENSION fakecron ')).toBeNull();
    expect(schemaOfTocLine(';')).toBeNull();
  });
});

describe('filterUnhostableSchemas', () => {
  const hostableSchemas = new Set(['public', 'pg_catalog', 'app']);

  it('drops an entry whose schema the restore will not create', () => {
    const { keptLines, skipped } = filterUnhostableSchemas(ORPHANED_TOC, { hostableSchemas });
    expect(skipped).toEqual([{ schema: 'fakecron', entries: 1 }]);
    expect(keptLines.some((line) => line.includes('TABLE DATA fakecron'))).toBe(false);
  });

  it('leaves the extension entries alone — they are the other filter\'s business', () => {
    const { keptLines } = filterUnhostableSchemas(ORPHANED_TOC, { hostableSchemas });
    expect(keptLines).toContain('5; 3079 19139 EXTENSION - fakecron ');
    expect(keptLines).toContain('3738; 0 0 COMMENT - EXTENSION fakecron ');
  });

  it('keeps every entry in a schema the restore WILL have', () => {
    const { keptLines } = filterUnhostableSchemas(ORPHANED_TOC, { hostableSchemas });
    expect(keptLines).toContain('215; 1259 16600 TABLE public User postgres');
    expect(keptLines).toContain('3579; 0 16600 TABLE DATA public User postgres');
    expect(keptLines).toContain('222; 1259 19122 TABLE app widget postgres');
  });

  it('REFUSES rather than skips when the dropped schema would be public', () => {
    /* The whole safety property: this filter exists to drop the platform's
       bookkeeping, and application data lives in `public`. A restore that
       would quietly thin it must fail by name instead. */
    const { skipped, missingRequired } = filterUnhostableSchemas(ORPHANED_TOC, {
      hostableSchemas: new Set(['pg_catalog', 'app']),
    });
    expect(missingRequired).toEqual(['public']);
    expect(skipped.map((entry) => entry.schema)).not.toContain('public');
  });

  it('counts a schema once, with its number of entries', () => {
    const toc = [
      '1; 0 1 TABLE DATA ghost a postgres',
      '2; 0 2 TABLE DATA ghost b postgres',
      '3; 0 3 SEQUENCE SET ghost c postgres',
    ].join('\n');
    const { skipped } = filterUnhostableSchemas(toc, { hostableSchemas });
    expect(skipped).toEqual([{ schema: 'ghost', entries: 3 }]);
  });

  it('skips nothing when every schema is hostable', () => {
    const { keptLines, skipped } = filterUnhostableSchemas(ORPHANED_TOC, {
      hostableSchemas: new Set(['public', 'pg_catalog', 'app', 'fakecron']),
    });
    expect(skipped).toEqual([]);
    expect(keptLines).toHaveLength(ORPHANED_TOC.split('\n').length);
  });
});

describe('the restore script composes both filters', () => {
  const script = readFileSync('scripts/restore-backup.mjs', 'utf8');

  it('reads the target\'s real schema list rather than hardcoding one', () => {
    expect(script).toContain('SELECT nspname FROM pg_namespace');
  });

  it('runs the schema filter over what the extension filter kept', () => {
    expect(script).toContain('filterUnhostableSchemas(keptLines.join(');
  });

  it('fails on a required schema instead of thinning the archive', () => {
    expect(script).toMatch(/if \(bySchema\.missingRequired\.length\) \{/);
  });
});
