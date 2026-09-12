import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  extensionOfTocLine,
  filterUnavailableExtensions,
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
 * Two properties are worth a test rather than a reading.
 *
 * The first is the one that was got wrong: an extension occupies TWO TOC
 * entries and only the first says EXTENSION in the type column, so a filter
 * written from the obvious shape leaves `COMMENT ON EXTENSION pg_cron`
 * behind and the restore dies one line later. The lines below are copied from
 * real `pg_restore --list` output, trailing space and all.
 *
 * The second is the safety property: skipping the PLATFORM's extensions keeps
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

describe('filterUnavailableExtensions', () => {
  const available = new Set(['pg_trgm', 'citext']);
  const required = new Set(['pg_trgm']);

  it('drops BOTH entries of an extension the target cannot host', () => {
    const { keptLines, skipped } = filterUnavailableExtensions(REAL_TOC, available, required);
    expect(skipped.sort()).toEqual(['pg_cron', 'supabase_vault']);
    expect(keptLines.some((line) => line.includes('pg_cron'))).toBe(false);
    expect(keptLines.some((line) => line.includes('supabase_vault'))).toBe(false);
  });

  it('keeps every entry the target can host, including the header and the data', () => {
    const { keptLines } = filterUnavailableExtensions(REAL_TOC, available, required);
    expect(keptLines).toContain('2; 3079 16385 EXTENSION - pg_trgm ');
    expect(keptLines).toContain('3455; 0 0 COMMENT - EXTENSION pg_trgm');
    expect(keptLines).toContain('215; 1259 16600 TABLE public User postgres');
    expect(keptLines).toContain('3458; 0 0 COMMENT - SCHEMA public postgres');
    expect(keptLines[0]).toBe(';');
  });

  it('reports an APPLICATION extension the target lacks instead of skipping it', () => {
    const { skipped, missingRequired } = filterUnavailableExtensions(
      REAL_TOC, new Set(['citext']), required,
    );
    expect(missingRequired).toEqual(['pg_trgm']);
    expect(skipped).not.toContain('pg_trgm');
  });

  it('names each extension once however many entries it occupies', () => {
    const { skipped } = filterUnavailableExtensions(REAL_TOC, available, required);
    expect(skipped).toEqual([...new Set(skipped)]);
  });

  it('skips nothing when the target provides everything', () => {
    const everything = new Set(['pg_trgm', 'pg_cron', 'supabase_vault']);
    const { keptLines, skipped, missingRequired } = filterUnavailableExtensions(
      REAL_TOC, everything, required,
    );
    expect(skipped).toEqual([]);
    expect(missingRequired).toEqual([]);
    expect(keptLines).toHaveLength(REAL_TOC.split('\n').length);
  });
});

describe('the restore script still uses the filter the way these tests describe', () => {
  const script = readFileSync('scripts/restore-backup.mjs', 'utf8');

  it('declares pg_trgm required, so a target without it fails rather than skips', () => {
    expect(script).toMatch(/REQUIRED_EXTENSIONS = new Set\(\['pg_trgm'\]\)/);
    expect(script).toMatch(/if \(missingRequired\.length\) \{\s*\n?\s*fail\(/);
  });

  it('reads the target for what it can host rather than hardcoding a skip list', () => {
    expect(script).toContain('SELECT name FROM pg_available_extensions');
  });

  it('keeps --exit-on-error, which is the whole point of filtering beforehand', () => {
    expect(script).toContain("'--exit-on-error'");
  });

  it('passes the surviving entries through --use-list', () => {
    expect(script).toContain("'--use-list'");
  });
});
