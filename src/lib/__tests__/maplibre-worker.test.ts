import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { MAPLIBRE_WORKER_URL } from '@/lib/maplibre-worker';
import {
  MAPLIBRE_VENDOR_DIR,
  MAPLIBRE_WORKER_FILE,
  MAPLIBRE_WORKER_FILES,
  relativeImportsOf,
} from '../../../scripts/vendor-maplibre-worker.mjs';

/**
 * The map's worker must come from a URL of ours.
 *
 * MapLibre v6 locates its tile-parsing worker from `import.meta.url`, which
 * webpack compiles to the build machine's file path; MapLibre rejects that,
 * falls back to "", and `new Worker("")` loads the page itself. Vector tiles
 * parse only in that worker, so the map stalled silently for every member from
 * the vector switch (2026-09-03) until this was found (2026-09-05). Three
 * things have to agree for the fix to hold, and each is asserted here rather
 * than described: the component hands MapLibre our URL, the build copies the
 * module to where that URL points, and the module's own imports all travel
 * with it.
 */
const root = process.cwd();
const map = readFileSync(path.join(root, 'src/components/mmm/MmmMap.tsx'), 'utf8');

describe('the MapLibre worker URL', () => {
  it('is set on MapLibre before the map is constructed', () => {
    const set = map.indexOf('maplibre.setWorkerUrl(MAPLIBRE_WORKER_URL)');
    const construct = map.indexOf('new maplibre.Map(');
    expect(set, 'MmmMap no longer calls setWorkerUrl — the worker would load the page again').toBeGreaterThan(-1);
    expect(set, 'setWorkerUrl must run before new Map(): the constructor spawns the workers').toBeLessThan(construct);
  });

  it('points at the file the build copies into public/', () => {
    expect(MAPLIBRE_WORKER_URL).toBe(`/${MAPLIBRE_VENDOR_DIR.replace(/^public\//, '')}/${MAPLIBRE_WORKER_FILE}`);
  });

  it('is same-origin, so worker-src \'self\' already permits it', () => {
    expect(MAPLIBRE_WORKER_URL.startsWith('/')).toBe(true);
    expect(MAPLIBRE_WORKER_URL.startsWith('//')).toBe(false);
  });

  it('copies every module the worker imports, from a dist layout that still exists', () => {
    const dist = path.join(root, 'node_modules/maplibre-gl/dist');
    for (const file of MAPLIBRE_WORKER_FILES) {
      expect(existsSync(path.join(dist, file)), `${file} is not in maplibre-gl/dist — the layout changed`).toBe(true);
    }
    const imports = relativeImportsOf(readFileSync(path.join(dist, MAPLIBRE_WORKER_FILE), 'utf8'));
    expect(imports.length, 'the worker imports nothing? the parse is wrong').toBeGreaterThan(0);
    expect(imports.filter((f) => !MAPLIBRE_WORKER_FILES.includes(f))).toEqual([]);
  });

  it('runs in every build path, so a fresh checkout cannot ship without it', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    for (const script of ['dev', 'prebuild', 'cf:build']) {
      expect(pkg.scripts[script], `${script} does not vendor the worker`).toContain('vendor-maplibre-worker.mjs');
    }
    expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain(`${MAPLIBRE_VENDOR_DIR}/`);
  });
});
