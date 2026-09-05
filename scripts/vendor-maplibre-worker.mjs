#!/usr/bin/env node
/**
 * Mirrors MapLibre's worker module into public/ so the browser can find it.
 *
 * THE BUG THIS EXISTS FOR (2026-09-05, DESIGN_SYNC row 350). MapLibre GL v6
 * ships its tile-parsing worker as a separate ES module and locates it with
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Webpack compiles
 * `import.meta.url` inside our client chunk to the BUILD MACHINE'S file path —
 * `file:///home/…/node_modules/maplibre-gl/dist/maplibre-gl.mjs` — which
 * MapLibre rejects as non-http and falls back to an empty URL, so
 * `new Worker("", { type: "module" })` loads the PAGE ITSELF as the worker.
 * The worker dies on the first byte of HTML; vector tiles are parsed only in
 * that worker; nothing parses, no `error` event fires, `load` never comes, and
 * `/app/map` reads "The map could not load" for every member. Raster tiles
 * never needed the worker, which is why the map worked until the vector switch
 * on 2026-09-03 and has not since. Measured: Playwright saw the worker created
 * from `http://localhost:8787/app/map` and closed at once.
 *
 * The fix is a URL of our own: `setWorkerUrl('/vendor/maplibre-gl/…')` in
 * MmmMap, pointing at these two files served as static assets. Same-origin,
 * so `worker-src 'self'` already permits it. The worker imports its shared
 * sibling by relative path, so both ship and the import resolves next to it.
 *
 * Copied at build time from the installed package rather than committed, the
 * same way `build-i18n-assets.mjs` mirrors the dictionaries: node_modules stays
 * the single source and a MapLibre upgrade cannot leave a stale worker behind.
 * `maplibre-worker.test.ts` fails if the worker's imports stop resolving to
 * what this copies, or if MmmMap stops pointing at the destination.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const MAPLIBRE_VENDOR_DIR = 'public/vendor/maplibre-gl';
export const MAPLIBRE_WORKER_FILE = 'maplibre-gl-worker.mjs';
export const MAPLIBRE_WORKER_FILES = [MAPLIBRE_WORKER_FILE, 'maplibre-gl-shared.mjs'];

const SOURCE_DIR = 'node_modules/maplibre-gl/dist';

/** Every `from "./x"` specifier in a module — the worker's dependencies. */
export function relativeImportsOf(source) {
  return [...source.matchAll(/from\s*"(\.\/[^"]+)"/g)].map((m) => m[1].slice(2));
}

export function vendorMaplibreWorker({ root = process.cwd(), log = console.log } = {}) {
  const src = path.join(root, SOURCE_DIR);
  const dest = path.join(root, MAPLIBRE_VENDOR_DIR);
  const workerSource = readFileSync(path.join(src, MAPLIBRE_WORKER_FILE), 'utf8');
  const missing = relativeImportsOf(workerSource).filter((f) => !MAPLIBRE_WORKER_FILES.includes(f));
  if (missing.length) {
    throw new Error(`maplibre-gl-worker.mjs imports ${missing.join(', ')}, which this script does not copy — add them to MAPLIBRE_WORKER_FILES`);
  }
  mkdirSync(dest, { recursive: true });
  for (const file of MAPLIBRE_WORKER_FILES) {
    const from = path.join(src, file);
    if (!existsSync(from)) throw new Error(`${from} is missing — did the maplibre-gl dist layout change?`);
    copyFileSync(from, path.join(dest, file));
    log(`[vendor-maplibre-worker] ${file} → ${MAPLIBRE_VENDOR_DIR}/ (${Math.round(statSync(from).size / 1024)} KB)`);
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  vendorMaplibreWorker();
}
