/**
 * Copies the translation dictionaries into public/i18n/ so they ship as
 * Cloudflare **static assets** instead of being bundled into the Worker script.
 *
 * Why this exists
 * ---------------
 * src/lib/i18n/server.ts used to statically import all 12 dictionaries. That is
 * fine on a Node server, but a Cloudflare Worker is uploaded as a SINGLE script
 * with a hard 10 MiB (gzip) limit, and the dictionaries were 2.26 MiB gzip of
 * it — measured by building with them emptied: worker.js went 7.36 -> 5.10 MiB.
 * With the user-facing translations complete the deployed Worker hit 9.07 MiB
 * against the 9 MiB budget in scripts/worker-size-budget.mjs, and the remaining
 * admin keys would have pushed it further.
 *
 * Per-locale `await import()` does NOT fix this: wrangler re-bundles dynamic
 * imports back into the one script (measured: 7.36 -> 7.37 MiB, i.e. very
 * slightly worse), and the split chunks are not uploaded at all, so the import
 * would fail at runtime and silently serve English. Static assets are a
 * separate upload that does not count toward the script limit, so that is where
 * these belong.
 *
 * src/lib/i18n/dictionaries/ stays the single source of truth — every tool
 * (scripts/apply-i18n-batch.mjs, scripts/extract-i18n-keys.mjs, the parity
 * test, the client's per-locale dynamic import) still reads it. This script
 * only mirrors it, so the generated copies are gitignored.
 *
 * en.json is deliberately NOT copied: getServerT() resolves English straight
 * from the inline t() fallbacks, exactly as the client does.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src/lib/i18n/dictionaries';
const OUT = 'public/i18n';

function main() {
  mkdirSync(OUT, { recursive: true });

  const files = readdirSync(SRC).filter((f) => f.endsWith('.json'));
  let written = 0;
  let bytes = 0;

  for (const file of files) {
    const locale = file.replace(/\.json$/, '');
    const target = join(OUT, `${locale}.json`);

    if (locale === 'en') {
      // If an earlier build wrote one, clear it — shipping it would invite a
      // future edit to reintroduce the en tier the client deliberately dropped.
      rmSync(target, { force: true });
      continue;
    }

    const parsed = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
    // Re-stringify without indentation: these are fetched, never read by hand.
    const minified = JSON.stringify(parsed);
    writeFileSync(target, minified);
    written += 1;
    bytes += Buffer.byteLength(minified);
  }

  console.log(
    `[build-i18n-assets] wrote ${written} locale file(s) to ${OUT}/ (${(bytes / 1024 / 1024).toFixed(2)} MiB raw)`
  );
}

main();
