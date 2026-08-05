import { describe, expect, it } from 'vitest';
import {
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
  it('has three level-1 slots and five level-2 slots at both breakpoints', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      expect(arcSlotsFor(1, breakpoint)).toBe(3);
      expect(arcSlotsFor(2, breakpoint)).toBe(5);
    }
  });

  // The arc has exactly five slots. A sixth MUSIC item would be in the manifest
  // and invisible on screen — the same failure class as the clipped submenu.
  it('has a slot for every MUSIC item and no item without a slot', () => {
    expect(MMM_MUSIC_TABS.length).toBe(arcSlotsFor(2));
  });

  it('unfurls upward from the thumb: ME first, then MUSIC, then MAP', () => {
    const delays = ARC.wide.level1.map((offset) => offset.delayMs);
    expect(delays).toEqual([60, 30, 0]);
  });

  it('staggers every level-2 slot distinctly and monotonically', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      const delays = ARC[breakpoint].level2.map((offset) => offset.delayMs);
      expect(new Set(delays).size).toBe(delays.length);
      expect([...delays].sort((a, b) => a - b)).toEqual(delays);
    }
  });

  it('fans every item up and to the right of the logo', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      for (const level of ['level1', 'level2'] as const) {
        for (const offset of ARC[breakpoint][level]) {
          expect(offset.y).toBeLessThan(0);
          expect(offset.x).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  // A collision here is the "one blob" bug in nav form: two pills stacked, one
  // unreachable. The pills are ~46px tall and up to ~180px wide, so slots must
  // be separated on at least one axis by more than that.
  it('separates every pair of slots in the same fan', () => {
    for (const breakpoint of ['wide', 'narrow'] as const) {
      for (const level of ['level1', 'level2'] as const) {
        const slots = ARC[breakpoint][level];
        for (let i = 0; i < slots.length; i += 1) {
          for (let j = i + 1; j < slots.length; j += 1) {
            const apart = Math.abs(slots[i].x - slots[j].x) > 60
              || Math.abs(slots[i].y - slots[j].y) > 46;
            expect(apart).toBe(true);
          }
        }
      }
    }
  });

  // The narrow arc is drawn for a 375px frame (iPhone SE 2, the smallest
  // breakpoint the design system names). Slot 5 sits at x=226 and has the least
  // headroom of any slot, so a longer MUSIC label is the thing most likely to
  // push a pill off-screen — which is why the width is derived from the actual
  // longest label in the manifest rather than hardcoded. DM Sans 14px averages
  // ~0.54em per character, plus the design's 18px horizontal padding each side.
  it('keeps every narrow-arc pill inside a 375px frame, using the real labels', () => {
    const longest = Math.max(...MMM_MUSIC_TABS.map((item) => item.label.length));
    const pillWidth = Math.ceil(longest * 14 * 0.54) + 36;
    for (const offset of ARC.narrow.level2) {
      expect(offset.x + pillWidth).toBeLessThanOrEqual(375);
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
