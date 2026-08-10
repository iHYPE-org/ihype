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

  it('still covers the six-module deck', () => {
    expect(isMapRoute('/listen')).toBe(true);
  });

  it('does not widen the policy on ordinary routes', () => {
    for (const path of ['/', '/login', '/shows', '/pages', '/admin', '/applesauce']) {
      expect(isMapRoute(path)).toBe(false);
    }
  });

  // /ui-preview does not exist in production and must not widen the policy
  // there — it is the only route whose allowance is environment-dependent.
  it('gates the preview route on development', () => {
    expect(isMapRoute('/ui-preview/module-deck', true)).toBe(true);
    expect(isMapRoute('/ui-preview/module-deck', false)).toBe(false);
    expect(isMapRoute('/ui-preview/module-deck')).toBe(false);
  });

  // A path that merely starts with the same characters is a different route.
  it('does not match on a shared prefix', () => {
    expect(isMapRoute('/apple')).toBe(false);
    expect(isMapRoute('/application')).toBe(false);
  });
});

describe('MAP_TILE_HOSTS', () => {
  // The live map draws CartoDB raster tiles. The policy used to allow only
  // openfreemap — the host a dev-only mockup uses — so the map that ships was
  // blocked while the one nobody runs in production was permitted.
  it('includes the host the live map actually fetches', () => {
    expect(MAP_TILE_HOSTS).toContain('https://*.basemaps.cartocdn.com');
  });

  it('is emitted as a space-separated CSP source list', () => {
    const emitted = MAP_TILE_HOSTS.join(' ');
    expect(emitted).not.toContain(',');
    expect(emitted).not.toContain(';');
    for (const host of MAP_TILE_HOSTS) expect(host.startsWith('https://')).toBe(true);
  });
});
