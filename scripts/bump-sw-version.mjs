/**
 * Injects the current git commit SHA into public/sw.js as the CACHE_VERSION.
 * Run in prebuild so every deployment automatically busts stale browser caches.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, '..', 'public', 'sw.js');

let sha;
try {
  sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  // Not a git repo or git not available (e.g. CI without git history) — use timestamp
  sha = Date.now().toString(36);
}

const version = `ihype-${sha}`;
const sw = readFileSync(swPath, 'utf8');
const updated = sw.replace(/^const CACHE_VERSION = '[^']*';/m, `const CACHE_VERSION = '${version}';`);

if (sw === updated) {
  console.log(`[bump-sw] CACHE_VERSION already up to date or pattern not found.`);
} else {
  writeFileSync(swPath, updated, 'utf8');
  console.log(`[bump-sw] CACHE_VERSION → ${version}`);
}
