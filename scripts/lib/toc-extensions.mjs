/*
  Which entries of a `pg_restore --list` table of contents belong to an
  extension, and which of those the restore target cannot host.

  WHY THIS IS A MODULE AND NOT FOUR LINES INSIDE THE RESTORE SCRIPT. An
  extension occupies TWO TOC entries, and only the first one looks like an
  extension:

      2; 3079 16385 EXTENSION - pg_trgm
      3455; 0 0 COMMENT - EXTENSION pg_trgm

  A filter that matches `EXTENSION` in the type column drops the first and
  keeps the second, and `COMMENT ON EXTENSION pg_cron` against a database
  where pg_cron was never created fails exactly as loudly as the statement it
  was supposed to replace — so the restore still dies, one line later, and the
  fix reads as if it did not work. That was found by running `pg_restore
  --list` over a real archive rather than by reasoning about the format.

  The ordinary `pg_restore --list | grep -v | --use-list` recipe found in most
  places has the same hole.

  AND "CANNOT HOST" HAS TWO HALVES, WHICH IS THE SECOND THING A REAL RUN
  TAUGHT. Skipping the extensions a stock Postgres does not provide got the
  drill past pg_cron and straight into:

      ERROR:  schema "stripe" does not exist
      STATEMENT:  CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA stripe;

  btree_gist IS available everywhere — what is missing is the SCHEMA it was
  installed into. The backup excludes the vendor-managed `stripe` schema by
  name (see backup-database.mjs), and an extension living inside that schema
  is part of it. So an extension is unhostable when the target lacks the
  extension OR when the archive does not restore the schema it belongs to;
  both are the platform's furniture rather than the product's.

  The TOC cannot answer the second question — an extension's schema column is
  `-`, not its schema — so the caller reads the archive's own
  `CREATE EXTENSION … WITH SCHEMA …` statements and passes them in.
*/

/** A TOC line is `id; oid oid TYPE schema name owner`. */
const EXTENSION_ENTRY = /^\s*\d+;\s+\d+\s+\d+\s+EXTENSION\s+\S+\s+(\S+)/;
const EXTENSION_COMMENT = /^\s*\d+;\s+\d+\s+\d+\s+COMMENT\s+\S+\s+EXTENSION\s+(\S+)/;
const SCHEMA_ENTRY = /^\s*\d+;\s+\d+\s+\d+\s+SCHEMA\s+\S+\s+(\S+)/;
const CREATE_EXTENSION = /CREATE EXTENSION (?:IF NOT EXISTS )?"?([^\s";]+)"?\s+WITH SCHEMA "?([^\s";]+)"?/gi;

/**
 * The extension an entry belongs to, or null when the line is not one.
 * @param {string} line one line of `pg_restore --list` output
 * @returns {string | null}
 */
export function extensionOfTocLine(line) {
  return (EXTENSION_ENTRY.exec(line)?.[1] ?? EXTENSION_COMMENT.exec(line)?.[1]) ?? null;
}

/**
 * The `EXTENSION` create entries, verbatim. Handed back to `pg_restore` as a
 * `--use-list` so it prints those statements and only those — the archive's
 * own answer to "which schema does this extension live in", which the table of
 * contents does not carry.
 * @param {string} tocText
 * @returns {string[]}
 */
export function extensionEntryLines(tocText) {
  return String(tocText).split('\n').filter((line) => EXTENSION_ENTRY.test(line));
}

/**
 * The schemas this archive creates for itself.
 * @param {string} tocText
 * @returns {Set<string>}
 */
export function schemasInToc(tocText) {
  const out = new Set();
  for (const line of String(tocText).split('\n')) {
    const match = SCHEMA_ENTRY.exec(line);
    if (match) out.add(match[1]);
  }
  return out;
}

/**
 * Extension name → the schema it is installed into, read from the archive's
 * own SQL.
 * @param {string} sqlText
 * @returns {Map<string, string>}
 */
export function parseExtensionSchemas(sqlText) {
  const out = new Map();
  const source = String(sqlText);
  CREATE_EXTENSION.lastIndex = 0;
  let match = CREATE_EXTENSION.exec(source);
  while (match) {
    out.set(match[1], match[2]);
    match = CREATE_EXTENSION.exec(source);
  }
  return out;
}

/**
 * Split a table of contents into the entries to restore and the extensions
 * dropped because the target cannot host them.
 *
 * `required` names extensions the APPLICATION declares (its own migrations
 * create them). One of those missing is a failed restore, never a skip — the
 * caller is handed the name and is expected to stop. Skipping the platform's
 * furniture keeps a drill honest; skipping the product's would make it a lie.
 *
 * @param {string} tocText  raw `pg_restore --list` output
 * @param {object} options
 * @param {Set<string>} options.availableExtensions  names from pg_available_extensions
 * @param {Map<string, string>} [options.extensionSchemas]  name → schema, from the archive's SQL
 * @param {Set<string>} [options.hostableSchemas]  schemas the restore will have
 * @param {Set<string>} [options.required]  extensions the application cannot run without
 * @returns {{ keptLines: string[], skipped: {name: string, reason: string}[], missingRequired: {name: string, reason: string}[] }}
 */
export function filterUnavailableExtensions(tocText, options = {}) {
  const {
    availableExtensions = new Set(),
    extensionSchemas = new Map(),
    hostableSchemas = null,
    required = new Set(),
  } = options;

  const keptLines = [];
  const skipped = new Map();
  const missingRequired = new Map();

  const unhostable = (name) => {
    if (!availableExtensions.has(name)) return 'the target does not provide it';
    const schema = extensionSchemas.get(name);
    if (hostableSchemas && schema && !hostableSchemas.has(schema)) {
      return `it lives in schema "${schema}", which this archive does not restore`;
    }
    return null;
  };

  for (const line of String(tocText).split('\n')) {
    const name = extensionOfTocLine(line);
    const reason = name ? unhostable(name) : null;
    if (name && reason) {
      (required.has(name) ? missingRequired : skipped).set(name, reason);
      continue;
    }
    keptLines.push(line);
  }

  const entries = (map) => [...map.entries()].map(([name, reason]) => ({ name, reason }));
  return { keptLines, skipped: entries(skipped), missingRequired: entries(missingRequired) };
}
