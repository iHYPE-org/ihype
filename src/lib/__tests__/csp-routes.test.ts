import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAP_TILE_HOSTS, isMapRoute } from '@/lib/csp-routes';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

describe('isMapRoute', () => {
  // The regression this file exists for. The predicate named '/listen' while
  // the signed-in landing surface had moved to /app/map, so the first screen
  // after sign-in got no tile host and no blob worker-src — a blank canvas.
  it('covers the path members land on after signing in', () => {
    expect(isMapRoute(WORKBENCH_PATH)).toBe(true);
  });

  // MmmShell is mounted in the /app LAYOUT, so the map survives navigation
  // between modules. An allowance scoped to /app/map alone would blank it on
  // the first move to another module.
  it('covers every /app route, not just the map module', () => {
    expect(isMapRoute('/app')).toBe(true);
    expect(isMapRoute('/app/map')).toBe(true);
    expect(isMapRoute('/app/music/for-you')).toBe(true);
    expect(isMapRoute('/app/me')).toBe(true);
    expect(isMapRoute('/app/me/settings')).toBe(true);
  });

  // The deck and its preview harness are retired, and so are their
  // allowances: one map surface, one tile host, no environment-dependent
  // widening.
  it('does not widen the policy on ordinary routes', () => {
    for (const path of ['/', '/login', '/listen', '/shows', '/pages', '/admin', '/ui-preview', '/applesauce']) {
      expect(isMapRoute(path), path).toBe(false);
    }
  });

  // A path that merely starts with the same characters is a different route.
  it('does not match on a shared prefix', () => {
    expect(isMapRoute('/apple')).toBe(false);
    expect(isMapRoute('/application')).toBe(false);
  });
});

/**
 * Does this source list actually permit this URL, by CSP's own rules?
 *
 * The rule that matters here is the one the outage turned on: a `*.` wildcard
 * stands in for ONE OR MORE labels, so it never matches the bare domain. CSP's
 * host-source grammar has no way to say "this domain and its subdomains" in a
 * single entry — that needs two.
 */
function cspAllows(url: string, sources: readonly string[]): boolean {
  const { protocol, hostname } = new URL(url);
  return sources.some((source) => {
    const match = /^(https?):\/\/(.+)$/.exec(source);
    if (!match) return false;
    const [, scheme, pattern] = match;
    if (`${scheme}:` !== protocol) return false;
    if (!pattern.startsWith('*.')) return hostname === pattern;
    /* One or more labels, not zero — `.endsWith('.rest')` is the whole bug. */
    return hostname.endsWith(`.${pattern.slice(2)}`);
  });
}

describe('cspAllows — the matcher this file checks with', () => {
  /* Verified in both directions before being trusted, because a matcher that
     says yes to everything would make every assertion below vacuous. */
  it('a wildcard covers a subdomain but never the bare domain', () => {
    const list = ['https://*.example.com'];
    expect(cspAllows('https://tiles.example.com/x', list)).toBe(true);
    expect(cspAllows('https://a.b.example.com/x', list)).toBe(true);
    expect(cspAllows('https://example.com/x', list)).toBe(false);
    expect(cspAllows('https://notexample.com/x', list)).toBe(false);
    expect(cspAllows('https://example.com.evil.test/x', list)).toBe(false);
  });

  it('an exact host matches only itself, and the scheme counts', () => {
    expect(cspAllows('https://example.com/x', ['https://example.com'])).toBe(true);
    expect(cspAllows('https://tiles.example.com/x', ['https://example.com'])).toBe(false);
    expect(cspAllows('http://example.com/x', ['https://example.com'])).toBe(false);
  });
});

describe('MAP_TILE_HOSTS', () => {
  /* Every absolute URL the real map builds, resolved against the policy the
     real middleware emits.
     
     THIS IS THE CHECK THAT WAS MISSING. What stood here asserted that the list
     CONTAINED the string `https://*.basemaps.cartocdn.com` — true, and true
     for the whole of the outage on 2026-09-03, when the vector style moved to
     the apex host that wildcard cannot match and the map went blank in
     production. A list of allowed hosts can only be verified against the URLs
     something actually fetches; asserting on its contents just restates it. */
  it('permits every URL the map builds — apex and subdomain alike', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/components/mmm/MmmMap.tsx'), 'utf8');
    const urls = [...src.matchAll(/https:\/\/[^'"`\s)]*basemaps\.cartocdn\.com[^'"`\s)]*/g)]
      .map((m) => m[0].replace(/\$\{[^}]*\}/g, 'x'));

    expect(urls.length, 'no CARTO URL found — has the basemap moved?').toBeGreaterThan(0);
    const refused = urls.filter((url) => !cspAllows(url, MAP_TILE_HOSTS));
    expect(refused, 'our own CSP refuses these, so the map cannot draw').toEqual([]);
  });

  /* The style document names the hosts its tiles, glyphs and sprites come
     from, and those are fetched by MapLibre under the same policy. Read from
     the live style on 2026-09-03; kept as literals rather than fetched so the
     suite stays offline and deterministic. Re-read them if the style moves. */
  it('permits the hosts the style document then sends the browser to', () => {
    const fromStyle = [
      'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
      'https://tiles.basemaps.cartocdn.com/fonts/Open%20Sans%20Regular/0-255.pbf',
      'https://tiles.basemaps.cartocdn.com/gl/voyager-gl-style/sprite.json',
    ];
    const refused = fromStyle.filter((url) => !cspAllows(url, MAP_TILE_HOSTS));
    expect(refused, 'the style loads and then its own references are blocked').toEqual([]);
  });

  it('is emitted as a space-separated CSP source list', () => {
    const emitted = MAP_TILE_HOSTS.join(' ');
    expect(emitted).not.toContain(',');
    expect(emitted).not.toContain(';');
    for (const host of MAP_TILE_HOSTS) expect(host.startsWith('https://')).toBe(true);
  });
});
