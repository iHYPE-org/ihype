import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The basemap probe's own preconditions.
 *
 * `scripts/check-basemap.mjs` reads the style URL out of `MmmMap.tsx` and the
 * host list out of `csp-routes.ts` rather than restating either — a copy is a
 * second thing to keep in sync, and this whole area exists because two things
 * drifted. That makes the probe silently useless the moment either shape
 * changes: it exits 2 rather than passing, but only when someone runs it.
 *
 * These assert the shapes it depends on, in the unit suite that runs on every
 * push, so a rename breaks here rather than in a nightly nobody reads.
 */
const map = readFileSync('src/components/mmm/MmmMap.tsx', 'utf8');
const probe = readFileSync('scripts/check-basemap.mjs', 'utf8');
const csp = readFileSync('src/lib/csp-routes.ts', 'utf8');

describe('the basemap probe can still find what it reads', () => {
  it('MmmMap declares CARTO_STYLE_URL as a template the probe can resolve', () => {
    const match = map.match(/const CARTO_STYLE_URL = `([^`]+)`/);
    expect(match, 'CARTO_STYLE_URL moved — check-basemap.mjs exits 2').not.toBeNull();
    expect(match![1]).toContain('${CARTO_BASEMAP_KEY}');
  });

  it('MmmMap still carries a default key, so the probe works with no env', () => {
    expect(map).toMatch(/NEXT_PUBLIC_CARTO_BASEMAP_KEY[\s\S]{0,240}?\|\|\s*'[^']+'/);
  });

  it('MAP_TILE_HOSTS is a parseable array with both the apex and the wildcard', () => {
    const block = csp.match(/MAP_TILE_HOSTS[^=]*=\s*\[([\s\S]*?)\]/);
    expect(block, 'MAP_TILE_HOSTS moved — check-basemap.mjs exits 2').not.toBeNull();
    const hosts = [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    /* Both, and the reason is the outage: `*.basemaps.cartocdn.com` stands in
       for one or more labels and never matches the apex, where the vector
       style document lives. One without the other is a blank map. */
    expect(hosts).toContain('https://basemaps.cartocdn.com');
    expect(hosts).toContain('https://*.basemaps.cartocdn.com');
  });

  it('the probe refuses to report success on a collapsed walk', () => {
    // Fewer than three dependencies means the style did not resolve, so a
    // "healthy" line would be a reassuring nothing — the same failure mode
    // feature-health.mts refuses for an empty report.
    expect(probe).toContain('rows.length < 3');
    expect(probe).toContain('nothing was proved');
  });
});
