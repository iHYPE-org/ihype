'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MmmMap, type MapSheetTarget } from '@/components/mmm/MmmMap';
import { MmmNav } from '@/components/mmm/MmmNav';
import { MmmPlayer } from '@/components/mmm/MmmPlayer';
import { MmmSheet } from '@/components/mmm/MmmSheet';
import { itemForPath, moduleForPath, navHint, type MmmModuleId } from '@/lib/mmm-nav';

export type MmmNowPlaying = { title: string; artist: string; initial: string } | null;

/**
 * The Music · Map · Me frame.
 *
 * ## The contract, from the handoff
 *
 * 1. **No header, no tab bar.** The only persistent chrome is the logo trigger
 *    and the player, both bottom-left. This was deliberate, to reclaim vertical
 *    space, and is the single biggest departure from the app shell it replaces.
 * 2. **The map is the base layer and stays mounted.** Music and Me are panes
 *    over it, so returning to MAP keeps your pan and zoom. This component is
 *    rendered by the `/app` LAYOUT, which is the only place the App Router
 *    guarantees a subtree survives navigation — the same reason `AppShell` sits
 *    in the root layout.
 * 3. **Module, tab and view are routes, not state.** The handoff says so
 *    explicitly. Only `navOpen`, `sheet`, `playing` and `hyped` live here.
 * 4. **Opening the nav dims everything, player included.** The player fades and
 *    drops out rather than being covered by the scrim, and the scrim sits above
 *    the map and the panes but below the fan.
 * 5. One scroll container: the module pane. `html`/`body` are locked by
 *    `.mmm-locked`, which this component toggles.
 */
export function MmmShell({ children, nowPlaying }: { children: ReactNode; nowPlaying: MmmNowPlaying }) {
  const pathname = usePathname() ?? '/app/map';
  const activeModule = moduleForPath(pathname);
  const activeItemId = itemForPath(pathname);
  const mapActive = activeModule === 'map';

  const [navOpen, setNavOpen] = useState(false);
  const [navSection, setNavSection] = useState<MmmModuleId | 'root'>('root');
  const [sheet, setSheet] = useState<MapSheetTarget | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hyped, setHyped] = useState(false);

  // Navigation closes the nav and resets it to level 1, per the interaction
  // table ("Tap submenu item → navigates, closes nav, resets section to root").
  useEffect(() => {
    setNavOpen(false);
    setNavSection('root');
  }, [pathname]);

  // Leaving the map closes any open pin sheet — it belongs to the map, and a
  // sheet floating over the Music pane would be orphaned chrome.
  useEffect(() => {
    if (!mapActive) setSheet(null);
  }, [mapActive]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mmm-locked');
    return () => root.classList.remove('mmm-locked');
  }, []);

  const closeNav = useCallback(() => {
    setNavOpen(false);
    setNavSection('root');
  }, []);

  const toggleNav = useCallback(() => {
    setSheet(null);
    setNavSection('root');
    setNavOpen((open) => !open);
  }, []);

  return (
    <div className="mmm-frame">
      <MmmMap active={mapActive && !navOpen} onOpenSheet={setSheet} />

      {!mapActive && <div className="mmm-pane">{children}</div>}

      {sheet && mapActive && <MmmSheet onClose={() => setSheet(null)} target={sheet} />}

      <div className="mmm-chrome">
        {/* The player fades and drops rather than unmounting, so its transition
            can play out — the design's `data-ih-hide` behaviour. Opening the nav
            still dims it completely, which was the explicit requirement. */}
        <MmmPlayer
          hidden={navOpen}
          hyped={hyped}
          onToggleHype={() => setHyped((value) => !value)}
          onTogglePlay={() => setPlaying((value) => !value)}
          playing={playing}
          track={nowPlaying}
        />

        {/* Always mounted: the arc animates between states, and unmounting it
            would make every open a fresh mount with no closing transition. */}
        <MmmNav
          activeItemId={activeItemId}
          activeModule={activeModule}
          onClose={closeNav}
          onSection={setNavSection}
          open={navOpen}
          section={navSection}
        />

        <button
          aria-expanded={navOpen}
          aria-label={navOpen ? 'Close iHYPE navigation' : 'Open iHYPE navigation'}
          className="mmm-logo"
          onClick={toggleNav}
          style={{ position: 'absolute', left: 26, bottom: 26, zIndex: 31 }}
          type="button"
        >
          <span>iHYPE</span>
          {playing && nowPlaying && (
            <span aria-hidden="true" className="mmm-eq"><span /><span /><span /></span>
          )}
        </button>

        {!navOpen && <div className="mmm-nav-hint">{navHint(pathname)}</div>}
      </div>
    </div>
  );
}
