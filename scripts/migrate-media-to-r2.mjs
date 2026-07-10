// One-off migration: move ArtistMediaAsset rows still stored as base64 in
// Postgres (storageProvider = 'database') into the ihype-media R2 bucket,
// then clear fileDataBase64 so the Worker never has to buffer whole files
// in memory again (Workers have a 128 MB ceiling; large audio rows are a
// crash risk and a Hyperdrive bandwidth tax).
//
// Dry-run by default — prints what would move without touching anything.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/migrate-media-to-r2.mjs            # dry run
//   DATABASE_URL=postgres://... node scripts/migrate-media-to-r2.mjs --execute  # migrate
//   ... --execute --limit 25                                                    # batch
//
// Requires wrangler auth (`npx wrangler login` or CLOUDFLARE_API_TOKEN) since
// the R2 binding only exists inside the Worker. Uploads go to the real bucket
// via `wrangler r2 object put --remote`.
//
// After all rows are migrated, a follow-up Prisma migration can drop the
// fileDataBase64 column and src/lib/media-response.ts's base64 branch.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const execute = process.argv.includes('--execute');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number.parseInt(process.argv[limitArg + 1], 10) : 1000;
const connectionString = process.env.DATABASE_URL;
const bucket = process.env.R2_BUCKET_NAME ?? 'ihype-media';
const publicBase = process.env.R2_PUBLIC_BASE_URL ?? 'https://ihype.org';

if (!connectionString) throw new Error('DATABASE_URL is required.');
if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer.');

// Mirrors sanitizePathSegment in src/lib/r2.ts so migrated keys sit next to
// keys produced by live uploads.
function sanitizePathSegment(value) {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

const client = new Client({ connectionString });
await client.connect();

try {
  const { rows } = await client.query(
    `SELECT id, "hexId", "profileId", "originalFileName", "mimeType", "fileSizeBytes"
     FROM "ArtistMediaAsset"
     WHERE "fileDataBase64" IS NOT NULL
     ORDER BY "createdAt" ASC
     LIMIT $1`,
    [limit]
  );

  if (rows.length === 0) {
    console.log('Nothing to migrate — no rows with fileDataBase64 remain.');
    process.exit(0);
  }

  const totalBytes = rows.reduce((sum, row) => sum + (row.fileSizeBytes ?? 0), 0);
  console.log(`${execute ? 'Migrating' : '[dry-run] Would migrate'} ${rows.length} asset(s), ~${(totalBytes / 1024 / 1024).toFixed(1)} MB total.`);

  const tempDir = execute ? mkdtempSync(join(tmpdir(), 'ihype-media-')) : null;
  let migrated = 0;
  let failed = 0;

  for (const row of rows) {
    const safeName = sanitizePathSegment(row.originalFileName || `${row.hexId}.media`) || `${row.hexId}.media`;
    const key = `artist-media/${sanitizePathSegment(row.profileId)}/${row.hexId}/${safeName}`;
    const url = `${publicBase.replace(/\/$/, '')}/cdn/${key}`;

    if (!execute) {
      console.log(`[dry-run] ${row.hexId} → r2://${bucket}/${key}`);
      continue;
    }

    try {
      // Fetch the payload one row at a time so the script itself doesn't
      // balloon when the backlog holds many large files.
      const { rows: [payload] } = await client.query(
        'SELECT "fileDataBase64" FROM "ArtistMediaAsset" WHERE id = $1',
        [row.id]
      );
      const bytes = Buffer.from(payload.fileDataBase64, 'base64');
      const tempFile = join(tempDir, row.hexId);
      writeFileSync(tempFile, bytes);

      execFileSync('npx', [
        'wrangler', 'r2', 'object', 'put', `${bucket}/${key}`,
        '--file', tempFile,
        '--content-type', row.mimeType || 'application/octet-stream',
        '--remote'
      ], { stdio: ['ignore', 'ignore', 'inherit'] });
      rmSync(tempFile, { force: true });

      await client.query(
        `UPDATE "ArtistMediaAsset"
         SET "storageProvider" = 'r2', "storageKey" = $2, "storageUrl" = $3, "fileDataBase64" = NULL, "updatedAt" = NOW()
         WHERE id = $1`,
        [row.id, key, url]
      );
      migrated += 1;
      console.log(`migrated ${row.hexId} (${(bytes.length / 1024 / 1024).toFixed(1)} MB) → ${key}`);
    } catch (error) {
      failed += 1;
      console.error(`FAILED ${row.hexId}: ${error.message} — row left untouched.`);
    }
  }

  if (tempDir) rmSync(tempDir, { recursive: true, force: true });

  if (execute) {
    console.log(`Done: ${migrated} migrated, ${failed} failed.`);
    if (failed > 0) process.exit(1);
  } else {
    console.log('Dry run only. Re-run with --execute to migrate.');
  }
} finally {
  await client.end();
}
