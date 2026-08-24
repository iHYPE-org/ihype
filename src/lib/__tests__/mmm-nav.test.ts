import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MMM_BASE,
  MMM_MAP_LAYERS,
  MMM_ME_PANELS,
  MMM_MODULES,
  MMM_MUSIC_TABS,
  MMM_NAV,
  isMmmDetailPath,
  isMmmRoute,
  itemForPath,
  moduleForPath,
  panelForPath,
  stationsForPath,
} from '@/lib/mmm-nav';

describe('MMM_NAV manifest', () => {
  it('is the three modules', () => {
    expect(MMM_NAV.map((module) => module.label)).toEqual(['MAP', 'MUSIC', 'ME']);
  });

  // The app-shell redesign dropped Search and added Recommended. Asserting the
  // exact list is what stops the older five from creeping back in.
  it('carries MUSIC’s six current items, with Library and no Search', () => {
    expect(MMM_MUSIC_TABS.map((item) => item.label))
      .toEqual(['Discover', 'Radio', 'Charts', 'Recommended', 'Playlists', 'Library']);
    expect(MMM_MUSIC_TABS.map((item) => item.id)).not.toContain('search');
  });

  // Both MAP and ME navigate directly now; only MUSIC fans out.
  it('gives MAP and ME no submenu, and MUSIC the only one', () => {
    expect(MMM_NAV.find((module) => module.id === 'map')!.items).toEqual([]);
    expect(MMM_NAV.find((module) => module.id === 'me')!.items).toEqual([]);
    expect(MMM_NAV.filter((module) => module.items.length > 0).map((module) => module.id)).toEqual(['music']);
  });

  it('carries the two canonical ME panels as in-page rows', () => {
    expect(MMM_ME_PANELS.map((panel) => panel.label))
      .toEqual(['Info', 'Settings']);
  });

  it('gives every ME panel a detail line, since the rows are drawn with one', () => {
    for (const panel of MMM_ME_PANELS) expect(panel.detail.length).toBeGreaterThan(0);
  });

  // Destinations must be distinct. A module's own href is deliberately the
  // same as its first item's (tapping MUSIC lands on Discover), so that alias
  // is excluded rather than counted as a collision.
  it('has a unique href for every destination', () => {
    const hrefs = [
      ...MMM_NAV.flatMap((module) => module.items.map((item) => item.href)),
      ...MMM_ME_PANELS.map((panel) => panel.href),
      ...MMM_NAV.filter((module) => module.items.length === 0).map((module) => module.href),
    ];
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('roots every href under the shell base', () => {
    const hrefs = [
      ...MMM_NAV.map((module) => module.href),
      ...MMM_NAV.flatMap((module) => module.items.map((item) => item.href)),
      ...MMM_ME_PANELS.map((panel) => panel.href),
    ];
    for (const href of hrefs) expect(href.startsWith(MMM_BASE)).toBe(true);
  });

  it('points MUSIC at its own first item', () => {
    expect(MMM_NAV.find((module) => module.id === 'music')!.href).toBe(MMM_MUSIC_TABS[0].href);
  });
});

describe('isMmmRoute', () => {
  it('claims the base and everything under it', () => {
    expect(isMmmRoute('/app')).toBe(true);
    expect(isMmmRoute('/app/map')).toBe(true);
    expect(isMmmRoute('/app/music/radio')).toBe(true);
  });

  it('does not claim other routes, including a same-prefix sibling', () => {
    expect(isMmmRoute('/listen')).toBe(false);
    expect(isMmmRoute('/applications')).toBe(false);
    expect(isMmmRoute('/')).toBe(false);
    expect(isMmmRoute(null)).toBe(false);
  });
});

describe('moduleForPath', () => {
  it('resolves each module', () => {
    expect(moduleForPath('/app/map')).toBe('map');
    expect(moduleForPath('/app/music/charts')).toBe('music');
    expect(moduleForPath('/app/me')).toBe('me');
    expect(moduleForPath('/app/me/legal')).toBe('me');
  });

  it('treats the bare base as map, which is where it redirects', () => {
    expect(moduleForPath('/app')).toBe('map');
  });
});

describe('itemForPath', () => {
  it('resolves the active MUSIC tab', () => {
    expect(itemForPath('/app/music/radio')).toBe('radio');
    expect(itemForPath('/app/music/recommended')).toBe('recommended');
  });

  it('is null on a module without a submenu', () => {
    expect(itemForPath('/app/map')).toBeNull();
    expect(itemForPath('/app/me')).toBeNull();
  });

  it('is null for an unknown child rather than guessing the first item', () => {
    expect(itemForPath('/app/music/nonsense')).toBeNull();
  });
});

describe('panelForPath', () => {
  it('resolves an open ME panel', () => {
    expect(panelForPath('/app/me/settings')).toBe('settings');
    expect(panelForPath('/app/me/accessibility')).toBe('settings');
    expect(panelForPath('/app/me/legal')).toBe('info');
  });

  it('is null at the ME root and outside ME', () => {
    expect(panelForPath('/app/me')).toBeNull();
    expect(panelForPath('/app/music/radio')).toBeNull();
  });
});

describe('detail surfaces', () => {
  it('treats a show as a pane, not a fourth module', () => {
    // The arc carries three modules and a show is not one of them — it is
    // something you reach FROM the map, so the hint keeps saying MAP.
    expect(isMmmDetailPath('/app/shows/null-harbor')).toBe(true);
    expect(moduleForPath('/app/shows/null-harbor')).toBe('map');
  });

  it('does not mistake the modules themselves for detail surfaces', () => {
    // `moduleForPath` answers 'map' for anything it does not recognise, and the
    // shell hides its children whenever the map is active. Without the
    // predicate a /app/shows route mounts and renders nothing at all, so this
    // is the assertion standing between that route and a blank screen.
    for (const path of ['/app/map', '/app/music/discover', '/app/me', '/app/me/settings']) {
      expect(isMmmDetailPath(path), path).toBe(false);
    }
  });

  it('is false for the legacy show route, which is a different shell', () => {
    expect(isMmmDetailPath('/shows/null-harbor')).toBe(false);
  });
});

/**
 * Every `/app/<segment>/[param]` route must be a known detail path.
 *
 * This is derived from the route directories on disk rather than hand-listed,
 * because the hand-listed version is what failed. `moduleForPath` answers
 * 'map' for anything it does not recognise, and `MmmShell` renders
 * `{!mapActive && <div className="mmm-pane">{children}</div>}` — so a route
 * missing from `MMM_DETAIL_PREFIXES` mounts, returns 200, paints the frame,
 * and shows NO CONTENT AT ALL.
 *
 * That is exactly what shipped: the artist, venue, track and playlist panes
 * were built, reviewed and merged while all four rendered a blank shell. No
 * check failed, because nothing threw and nothing 404'd — the only symptom was
 * an empty pane, which a browser test caught and no static check could.
 */
describe('every /app detail route renders as a pane', () => {
  // The three module roots own their own rendering; everything else under
  // `/app` is a detail surface and needs a prefix.
  const MODULE_SEGMENTS = new Set(['map', 'music', 'me']);

  const detailSegments = readdirSync('src/app/app', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !MODULE_SEGMENTS.has(name))
    // A dynamic segment directory (`[slug]`) is a param, not a surface.
    .filter((name) => !name.startsWith('['));

  it('finds the route directories, so a move cannot empty this into a pass', () => {
    expect(detailSegments.length).toBeGreaterThan(0);
  });

  it.each(detailSegments)('/app/%s/<param> is a detail path', (segment) => {
    expect(isMmmDetailPath(`/app/${segment}/anything`)).toBe(true);
  });

  it('a module root is NOT a detail path', () => {
    expect(isMmmDetailPath('/app/map')).toBe(false);
    expect(isMmmDetailPath('/app/music/discover')).toBe(false);
    expect(isMmmDetailPath('/app/me')).toBe(false);
  });
});

/**
 * The dock's dial, which is now the only section control in the app.
 *
 * Two of these are the bugs the vendored `TunerDial` warns about in its own
 * source: an `active` naming no station makes it render a confident, wrong
 * readout, and a module root is the FIRST station rather than no station.
 */
describe('stationsForPath', () => {
  it('tunes the map by layer, defaulting to events', () => {
    expect(stationsForPath(`${MMM_BASE}/map`)).toEqual({
      stations: MMM_MAP_LAYERS,
      active: 'events',
    });
    expect(stationsForPath(`${MMM_BASE}/map`, { layer: 'venues' }).active).toBe('venues');
  });

  it('ignores a layer the map does not have rather than lighting nothing', () => {
    expect(stationsForPath(`${MMM_BASE}/map`, { layer: 'pubs' }).active).toBe('events');
    expect(stationsForPath(`${MMM_BASE}/map`, { layer: null }).active).toBe('events');
  });

  it('tunes MUSIC by tab, and a module root is its first station', () => {
    expect(stationsForPath(`${MMM_BASE}/music/charts`)).toEqual({
      stations: MMM_MUSIC_TABS,
      active: 'charts',
    });
    expect(stationsForPath(`${MMM_BASE}/music`).active).toBe(MMM_MUSIC_TABS[0].id);
  });

  it('tunes ME by panel', () => {
    expect(stationsForPath(`${MMM_BASE}/me/settings`)).toEqual({
      stations: MMM_ME_PANELS,
      active: 'settings',
    });
    expect(stationsForPath(`${MMM_BASE}/me`).active).toBe(MMM_ME_PANELS[0].id);
  });

  it('always names a station that is in the set it returns', () => {
    for (const path of [
      `${MMM_BASE}`,
      `${MMM_BASE}/map`,
      `${MMM_BASE}/music`,
      `${MMM_BASE}/music/nonsense`,
      `${MMM_BASE}/me`,
      `${MMM_BASE}/me/nonsense`,
      `${MMM_BASE}/shows/a-show`,
    ]) {
      const { stations, active } = stationsForPath(path);
      expect(stations.some((station) => station.id === active)).toBe(true);
    }
  });

  it('gives every module at least two stations, so the dial is never a label', () => {
    for (const module of MMM_MODULES) {
      const href = MMM_NAV.find((entry) => entry.id === module)!.href;
      expect(stationsForPath(href).stations.length).toBeGreaterThan(1);
    }
  });
});
