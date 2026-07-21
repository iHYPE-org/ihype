/**
 * Worker bundle size budget — fails CI if the built Cloudflare Worker is on
 * track to exceed Cloudflare's hard 10 MiB (gzip) script size limit.
 *
 * Added 2026-07-21 after a production incident: a stray duplicate import
 * (17 files importing the Prisma client from plain '@prisma/client' instead
 * of the '@prisma/client/edge' subpath db.ts correctly uses — see
 * src/lib/__tests__/prisma-workerd-config.test.ts) caused esbuild to bundle
 * two full copies of the generated Prisma client into the server function,
 * and a routine dependency bump (a bigger Prisma WASM query compiler) was
 * the straw that tipped the combined bundle over Cloudflare's limit. Every
 * CI check (typecheck, lint, tests, even the Cloudflare build step itself)
 * passed — nothing caught it before `wrangler deploy` rejected it in
 * production, hours after the breaking commit had already merged.
 *
 * This budget exists so the next regression like that shows up as a failed
 * PR check instead of a failed production deploy. It uses `wrangler deploy
 * --dry-run --outdir` to get wrangler's OWN real bundling output — the
 * exact worker.js plus the exact set of attached compiled-wasm/buffer
 * modules a real deploy would upload — rather than approximating from
 * OpenNext's intermediate .open-next/ directory layout, which includes a
 * lot of on-disk node_modules/.next reference files that never actually
 * ship (an earlier version of this script over-counted by 3x that way).
 * wrangler duplicates each attached module as both a content-hashed file at
 * the output root (what's actually uploaded) and a copy at its original
 * node_modules-relative path (its intermediate source layout) — dedupe by
 * only summing the root-level files, keyed off the manifest wrangler prints
 * to stdout with `--dry-run`, not by re-deriving them from the directory
 * tree.
 *
 * Usage: node scripts/worker-size-budget.mjs (run after `npm run cf:build`)
 * Requires dummy CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID env vars — a
 * dry run never authenticates or uploads, but wrangler still wants the vars
 * present to get as far as producing the bundle.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const MIB = 1024 * 1024;
// Cloudflare's hard limit is 10 MiB gzip. Budget sits below that so CI goes
// red with real headroom to spare, not the instant the true ceiling is hit.
const BUDGET_BYTES = 9 * MIB;

function main() {
  const outdir = mkdtempSync(join(tmpdir(), 'worker-size-budget-'));
  let stdout;
  try {
    stdout = execFileSync(
      'npx',
      ['wrangler', 'deploy', 'worker.js', '--autoconfig=false', '--dry-run', `--outdir=${outdir}`],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || 'dry-run-placeholder',
          CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || 'dry-run-placeholder',
        },
      }
    );
  } catch (err) {
    console.error('[worker-size-budget] wrangler --dry-run failed:');
    console.error(err.stdout || err.message);
    process.exit(1);
  }

  // Parse the "Attaching additional modules" table wrangler prints — the
  // authoritative list of every module (besides worker.js itself) that
  // will actually be uploaded, each named by its original module path.
  const moduleNames = [];
  const tableLines = stdout.split('\n');
  for (const line of tableLines) {
    const match = line.match(/^│\s+(\S.*?)\s+│\s+(compiled-wasm|buffer)\s+│/);
    if (match) moduleNames.push(match[1].trim());
  }

  const entries = [{ label: 'worker.js', path: join(outdir, 'worker.js') }];
  for (const name of moduleNames) {
    entries.push({ label: name, path: join(outdir, name) });
  }

  const results = [];
  let total = 0;
  for (const { label, path } of entries) {
    let raw;
    try {
      raw = readFileSync(path);
    } catch {
      console.warn(`[worker-size-budget] expected module not found in dry-run output, skipping: ${label}`);
      continue;
    }
    const gz = gzipSync(raw, { level: 9 }).length;
    total += gz;
    results.push({ label, raw: raw.length, gz });
  }

  rmSync(outdir, { recursive: true, force: true });

  results.sort((a, b) => b.gz - a.gz);
  console.log('[worker-size-budget] Deployed Worker contents (gzip):');
  for (const { label, raw, gz } of results) {
    console.log(`  ${(gz / MIB).toFixed(2).padStart(7)} MiB gz  (${(raw / MIB).toFixed(2).padStart(7)} MiB raw)  ${label}`);
  }

  console.log(
    `[worker-size-budget] Total: ${(total / MIB).toFixed(2)} MiB gzip / budget ${(BUDGET_BYTES / MIB).toFixed(0)} MiB (Cloudflare hard limit: 10 MiB)`
  );

  if (total > BUDGET_BYTES) {
    console.error(
      `[worker-size-budget] FAIL: Worker bundle is ${((total - BUDGET_BYTES) / MIB).toFixed(2)} MiB over budget. ` +
        'Cloudflare will likely reject this deploy outright. Check the contents above for an accidental duplicate import or a newly-added heavy dependency.'
    );
    process.exit(1);
  }

  console.log('[worker-size-budget] PASS');
}

main();
