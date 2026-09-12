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
*/

/** A TOC line is `id; oid oid TYPE schema name owner`. */
const EXTENSION_ENTRY = /^\s*\d+;\s+\d+\s+\d+\s+EXTENSION\s+\S+\s+(\S+)/;
const EXTENSION_COMMENT = /^\s*\d+;\s+\d+\s+\d+\s+COMMENT\s+\S+\s+EXTENSION\s+(\S+)/;

/**
 * The extension an entry belongs to, or null when the line is not one.
 * @param {string} line one line of `pg_restore --list` output
 * @returns {string | null}
 */
export function extensionOfTocLine(line) {
  return (EXTENSION_ENTRY.exec(line)?.[1] ?? EXTENSION_COMMENT.exec(line)?.[1]) ?? null;
}

/**
 * Split a table of contents into the entries to restore and the extensions
 * dropped because the target does not provide them.
 *
 * `required` names extensions the APPLICATION declares (its own migrations
 * create them). One of those missing is a failed restore, never a skip — the
 * caller is handed the name and is expected to stop. Skipping the platform's
 * furniture keeps a drill honest; skipping the product's would make it a lie.
 *
 * @param {string} tocText  raw `pg_restore --list` output
 * @param {Set<string>} availableExtensions  names from pg_available_extensions
 * @param {Set<string>} required  extensions the application cannot run without
 * @returns {{ keptLines: string[], skipped: string[], missingRequired: string[] }}
 */
export function filterUnavailableExtensions(tocText, availableExtensions, required = new Set()) {
  const keptLines = [];
  const skipped = new Set();
  const missingRequired = new Set();

  for (const line of String(tocText).split('\n')) {
    const name = extensionOfTocLine(line);
    if (name && !availableExtensions.has(name)) {
      if (required.has(name)) missingRequired.add(name);
      else skipped.add(name);
      continue;
    }
    keptLines.push(line);
  }

  return { keptLines, skipped: [...skipped], missingRequired: [...missingRequired] };
}
