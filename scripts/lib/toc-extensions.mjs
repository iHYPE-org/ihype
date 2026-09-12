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
/* `id; oid oid TYPE schema name owner` — the schema is the field after the
   type, and it is a literal `-` for objects that have none (an extension, a
   comment on the database). */
const ANY_ENTRY = /^\s*\d+;\s+\d+\s+\d+\s+[A-Z][A-Z ]*\s+(\S+)\s/;
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

/**
 * The schema an entry belongs to, or null when it has none.
 * @param {string} line
 * @returns {string | null}
 */
export function schemaOfTocLine(line) {
  const schema = ANY_ENTRY.exec(line)?.[1];
  return !schema || schema === '-' ? null : schema;
}

/**
 * Drop the entries whose SCHEMA the restore will not have.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT THE SAME AS WIDENING THE FILTER ABOVE.
 * Skipping `CREATE EXTENSION pg_cron` leaves the extension's own configuration
 * table behind: pg_dump emits `COPY cron.job … FROM stdin` as ordinary table
 * data, because pg_cron registers that table with `pg_extension_config_dump`.
 * The fourth drill run died on it — `ERROR: schema "cron" does not exist` —
 * and the comment in `restore-backup.mjs` had said in advance that a different
 * object would need a different decision rather than a wider filter.
 *
 * This is that decision, and it is the same judgement rather than a new one:
 * `cron.job` is pg_cron's own bookkeeping, in a schema created by an extension
 * this restore deliberately does not install, for a scheduler this product
 * does not use — iHYPE's jobs run on Cloudflare. It is the platform's
 * furniture, exactly like the extension that owns it.
 *
 * The MECHANISM is not a judgement at all, which is what makes it safe: an
 * entry whose schema neither the archive creates nor the target already has
 * cannot be restored under any circumstances. The only judgement is whether to
 * skip or fail, and `required` is how that is answered — `public` is in it, so
 * a run that would drop application data fails by name instead.
 *
 * @param {string} tocText
 * @param {object} options
 * @param {Set<string>} options.hostableSchemas
 * @param {Set<string>} [options.required]  schemas whose absence is a failure
 * @returns {{ keptLines: string[], skipped: {schema: string, entries: number}[], missingRequired: string[] }}
 */
export function filterUnhostableSchemas(tocText, options = {}) {
  const { hostableSchemas = new Set(), required = new Set(['public']) } = options;
  const keptLines = [];
  const skipped = new Map();
  const missingRequired = new Set();

  for (const line of String(tocText).split('\n')) {
    const schema = schemaOfTocLine(line);
    if (schema && !hostableSchemas.has(schema)) {
      if (required.has(schema)) {
        missingRequired.add(schema);
        keptLines.push(line);   // kept so the caller's failure is about the schema, not a thinned archive
        continue;
      }
      skipped.set(schema, (skipped.get(schema) ?? 0) + 1);
      continue;
    }
    keptLines.push(line);
  }

  return {
    keptLines,
    skipped: [...skipped.entries()].map(([schema, entries]) => ({ schema, entries })),
    missingRequired: [...missingRequired],
  };
}

/** `TABLE DATA schema name owner` and `TABLE schema name owner`. */
const TABLE_DATA_ENTRY = /^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)/;
const TABLE_ENTRY = /^\s*\d+;\s+\d+\s+\d+\s+TABLE\s+(\S+)\s+(\S+)/;

/**
 * Drop table DATA for a table the archive never creates.
 *
 * THE THIRD SHAPE, AND THE ONE THE SCHEMA FILTER CANNOT SEE. supabase_vault
 * registers `vault.secrets` with `pg_extension_config_dump`, so pg_dump emits
 * its rows — but the TABLE is an extension member, so no `CREATE TABLE` is
 * emitted, while the `vault` SCHEMA *is* dumped. The schema therefore looks
 * hostable and the COPY is kept, and the fifth drill run died on
 * `relation "vault.secrets" does not exist`. `cron.job` differed only in that
 * its schema was a member too.
 *
 * `backup-database.mjs` now excludes those extensions outright, which is the
 * real fix; this stays for every archive written before that, including the
 * `latest` the drill restores today.
 *
 * WHAT IT COULD COST, stated because it is not nothing: an extension that this
 * restore DOES install could own a config table, and its data would be skipped
 * here even though it would have loaded. No extension this product installs
 * has one, and every skip is NAMED in the output rather than silent — a
 * reportable loss, never an invisible one.
 *
 * @param {string} tocText
 * @returns {{ keptLines: string[], skipped: string[] }}
 */
export function filterOrphanedTableData(tocText) {
  const lines = String(tocText).split('\n');
  const created = new Set();
  for (const line of lines) {
    const match = TABLE_ENTRY.exec(line);
    /* TABLE DATA also starts with "TABLE", so the data pattern is tested
       first and its matches are not creations. */
    if (match && !TABLE_DATA_ENTRY.test(line)) created.add(`${match[1]}.${match[2]}`);
  }

  const keptLines = [];
  const skipped = new Set();
  for (const line of lines) {
    const match = TABLE_DATA_ENTRY.exec(line);
    const qualified = match && `${match[1]}.${match[2]}`;
    if (qualified && !created.has(qualified)) {
      skipped.add(qualified);
      continue;
    }
    keptLines.push(line);
  }

  return { keptLines, skipped: [...skipped] };
}
