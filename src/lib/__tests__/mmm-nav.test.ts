import { describe, expect, it } from 'vitest';
import {
  isMmmDetailPath,
  ARC,
  ARC_NARROW_MAX_WIDTH,
  MMM_BASE,
  MMM_ME_PANELS,
  MMM_MUSIC_TABS,
  MMM_NAV,
  arcSlotsFor,
  arcTransform,
  isMmmRoute,
  itemForPath,
  moduleForPath,
  navHint,
  panelForPath,
} from '@/lib/mmm-nav';

describe('MMM_NAV manifest', () => {
  it('is the three modules', () => {
    expect(MMM_NAV.map((module) => module.label)).toEqual(['MAP', 'MUSIC', 'ME']);
  });

  // The app-shell redesign dropped Search and added Recommended. Asserting the
  // exact list is what stops the older five from creeping back in.
  it('carries MUSIC’s five current items, with Recommended and no Search', () => {
    expect(MMM_MUSIC_TABS.map((item) => item.label))
      .toEqual(['Discover', 'Radio', 'Charts', 'Recommended', 'Playlists']);
    expect(MMM_MUSIC_TABS.map((item) => item.id)).not.toContain('search');
  });

  // Both MAP and ME navigate directly now; only MUSIC fans out.
  it('gives MAP and ME no submenu, and MUSIC the only one', () => {
    expect(MMM_NAV.find((module) => module.id === 'map')!.items).toEqual([]);
    expect(MMM_NAV.find((module) => module.id === 'me')!.items).toEqual([]);
    expect(MMM_NAV.filter((module) => module.items.length > 0).map((module) => module.id)).toEqual(['music']);
  });

  it('carries the four ME panels as in-page rows', () => {
    expect(MMM_ME_PANELS.map((panel) => panel.label))
      .toEqual(['Settings', 'Info', 'Legal', 'Accessibility']);
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

describe('radial arc geometry', () => {
  // The design's own tables, asserted literally. The previous values here were
  // hand-tuned and disagreed with `components/shell/ArcNav.jsx` in every slot
  // at both breakpoints, while the breakpoint and the delays happened to match
  // — so nothing caught it. Copied numbers are worth pinning; derived ones are
  // not, and these are copied.
  it('matches the design system’s slot tables exactly', () => {
    expect(ARC.wide.level1.map(({ x, y }) => [x, y])).toEqual([
      [5, -192], [115, -152], [182, -48],
    ]);
    expect(ARC.narrow.level1.map(({ x, y }) => [x, y])).toEqual([
      [4, -176], [100, -132], [165, -43],
    ]);
  });

  // "There is no second level: Music's sections are tabs at the top of the
  // Music pane" — ArcNav.d.ts. A second arc would be a duplicate route to the
  // five destinations MmmMusic's tab strip already carries.
  it('has exactly one level, of three discs, at both breakpoints', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      expect(arcSlotsFor(breakpoint)).toBe(3);
      expect(Object.keys(ARC[breakpoint])).toEqual(['level1']);
    }
  });

  it('has a disc for every module and no module without one', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      expect(ARC[breakpoint].level1.length).toBe(MMM_NAV.length);
    }
  });

  it('unfurls upward from the thumb: ME first, then MUSIC, then MAP', () => {
    const delays = ARC.wide.level1.map((offset) => offset.delayMs);
    expect(delays).toEqual([60, 30, 0]);
  });

  it('fans every disc up and to the right of the logo', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      for (const offset of ARC[breakpoint].level1) {
        expect(offset.y).toBeLessThan(0);
        expect(offset.x).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // A collision is the "one blob" bug in nav form: two discs stacked, one
  // unreachable. The design's own note gives the rule — centres need roughly
  // 104px between them, because the 92px MARK sets the footprint, not the 66px
  // disc it sits in.
  it('keeps every pair of disc centres about 104px apart', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      const slots = ARC[breakpoint].level1;
      for (let i = 0; i < slots.length; i += 1) {
        for (let j = i + 1; j < slots.length; j += 1) {
          const dx = slots[i].x - slots[j].x;
          const dy = slots[i].y - slots[j].y;
          expect(Math.hypot(dx, dy)).toBeGreaterThan(104);
        }
      }
    }
  });

  // The narrow arc is drawn for a 375px frame (iPhone SE 2, the smallest the
  // design system names). A disc is 66px, but the mark overhangs it, so the
  // 92px footprint is what has to fit.
  it('keeps every narrow disc inside a 375px frame at its full mark width', () => {
    for (const offset of ARC.narrow.level1) {
      expect(offset.x + 92).toBeLessThanOrEqual(375);
    }
  });

  it('switches at the design’s own breakpoint', () => {
    expect(ARC_NARROW_MAX_WIDTH).toBe(720);
  });

  it('renders a transform string', () => {
    expect(arcTransform({ x: 6, y: -186, delayMs: 0 })).toBe('translate(6px, -186px)');
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
    expect(panelForPath('/app/me/accessibility')).toBe('accessibility');
  });

  it('is null at the ME root and outside ME', () => {
    expect(panelForPath('/app/me')).toBeNull();
    expect(panelForPath('/app/music/radio')).toBeNull();
  });
});

describe('navHint', () => {
  it('names the module you are in — the only wayfinding left once the header is gone', () => {
    expect(navHint('/app/map')).toBe('MAP');
    expect(navHint('/app/music/charts')).toBe('MUSIC');
    expect(navHint('/app/me')).toBe('ME');
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
