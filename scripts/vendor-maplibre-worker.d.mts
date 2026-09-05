/**
 * Type surface of vendor-maplibre-worker.mjs for maplibre-worker.test.ts —
 * the script stays plain ESM so node can run it in the build chain.
 */
export const MAPLIBRE_VENDOR_DIR: string;
export const MAPLIBRE_WORKER_FILE: string;
export const MAPLIBRE_WORKER_FILES: string[];
export function relativeImportsOf(source: string): string[];
export function vendorMaplibreWorker(options?: { root?: string; log?: (line: string) => void }): void;
