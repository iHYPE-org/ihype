/**
 * Where the browser finds MapLibre's tile-parsing worker.
 *
 * MapLibre v6 would derive this from `import.meta.url`, and inside our webpack
 * chunk that is the build machine's `file:///…/node_modules/…` path — rejected
 * as non-http, replaced with "", and `new Worker("")` then loads the page as
 * the worker. Vector tiles parse only in that worker, so the map stalls with
 * no error. `scripts/vendor-maplibre-worker.mjs` copies the module and its
 * shared sibling here at build time; `MmmMap` hands this URL to
 * `setWorkerUrl()` before constructing the map. Same origin, so the existing
 * `worker-src 'self'` permits it. See DESIGN_SYNC row 350.
 */
export const MAPLIBRE_WORKER_URL = '/vendor/maplibre-gl/maplibre-gl-worker.mjs';
