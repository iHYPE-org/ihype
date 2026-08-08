'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MmmMap, type MapSheetTarget } from '@/components/mmm/MmmMap';
import { MmmNav } from '@/components/mmm/MmmNav';
import { MmmPlayer } from '@/components/mmm/MmmPlayer';
import { MmmSheet } from '@/components/mmm/MmmSheet';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { itemForPath, moduleForPath, navHint, type MmmModuleId } from '@/lib/mmm-nav';

export type MmmNowPlaying = {
  title: string;
  artist: string;
  initial: string;
  /**
   * The artist's profile id, or null when the artist cannot be hyped from here
   * — no linked profile, a non-discoverable one, or the viewer's own. The
   * layout resolves this server-side so HYPE is never a control that is
   * guaranteed to fail.
   */
  artistProfileId: string | null;
  /** Whether the viewer has already hyped that profile. */
  hyped: boolean;
} | null;

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
export function MmmShell({
  canFavourite,
  children,
  nowPlaying,
}: {
  /** Resolved server-side: `/api/fan-favorites` is FAN/ADMIN only. */
  canFavourite: boolean;
  children: ReactNode;
  nowPlaying: MmmNowPlaying;
}) {
  const pathname = usePathname() ?? '/app/map';
  const activeModule = moduleForPath(pathname);
  const activeItemId = itemForPath(pathname);
  const mapActive = activeModule === 'map';

  const [navOpen, setNavOpen] = useState(false);
  const [navSection, setNavSection] = useState<MmmModuleId | 'root'>('root');
  const [sheet, setSheet] = useState<MapSheetTarget | null>(null);
  const [hyped, setHyped] = useState(nowPlaying?.hyped ?? false);
  const [hypePending, setHypePending] = useState(false);
  const [favourited, setFavourited] = useState(false);
  const [favouritePending, setFavouritePending] = useState(false);

  // Real playback, not local state. The pill used to own a `playing` boolean
  // that toggled nothing — DESIGN_SYNC row 268 open item (d). /app sits inside
  // AppProviders, so the same MediaPlayerProvider the rest of the site uses is
  // already overhead; the pill just was not reading it.
  const { currentTrack, isPlaying, togglePlayback } = useMediaPlayer();

  // Two different things can be shown here, and they are not interchangeable.
  // `currentTrack` is what the audio element actually holds. `nowPlaying` is a
  // server-resolved "your most recent listen" with no URL attached, so it can
  // be displayed but cannot be started. Prefer the real one whenever it exists.
  const displayTrack = currentTrack
    ? {
        title: currentTrack.title,
        artist: currentTrack.artistName,
        initial: (currentTrack.artistName || currentTrack.title).charAt(0).toUpperCase(),
      }
    : nowPlaying;

  // HYPE resolves its target server-side, against `nowPlaying`. If the audio
  // element has since moved to a different track, that target is no longer the
  // artist on screen — so the control is hidden rather than left pointing at the
  // wrong profile.
  const canHype = !currentTrack && Boolean(nowPlaying?.artistProfileId);

  // The heart is the OTHER control, and it gates on the opposite condition:
  // saving a track needs the track — `/api/fan-favorites` takes a media id and
  // a URL, which only `currentTrack` carries. So HYPE is available for a
  // server-resolved recent listen and the heart is not, and both are absent
  // when neither condition holds. They are never the same button: ADHERENCE
  // rule 22 — "HYPE spends from your balance and moves the artist up the local
  // chart; the heart only saves the track. Never collapse them — the mechanic
  // the product is named after disappears into a bookmark." One heart used to
  // do the hyping here, which is exactly that collapse.
  const canFavouriteTrack = canFavourite && Boolean(currentTrack);

  // A different track means a different saved state. Without this the heart
  // stayed filled from the previous track across a skip.
  useEffect(() => { setFavourited(false); }, [currentTrack?.id]);

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

  // HYPE writes through to /api/hype — the same toggle endpoint the artist
  // page's HypeButton posts to, so a hype tapped here counts once, in the same
  // place, and spends from the same balance.
  //
  // Optimistic, then reverted on failure: the endpoint is a real toggle with a
  // hype-balance spend behind it, and leaving the heart filled after a refusal
  // would tell the viewer they spent a hype they still have. The server's own
  // `action` is what the final state comes from, not the optimistic guess.
  const toggleHype = useCallback(async () => {
    const profileId = nowPlaying?.artistProfileId;
    if (!profileId || hypePending) return;
    const previous = hyped;
    setHyped(!previous);
    setHypePending(true);
    try {
      const res = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'profile', targetId: profileId }),
      });
      if (!res.ok) {
        setHyped(previous);
        return;
      }
      const data = (await res.json()) as { action?: string };
      if (data.action === 'hyped' || data.action === 'unhyped') {
        setHyped(data.action === 'hyped');
      }
    } catch {
      setHyped(previous);
    } finally {
      setHypePending(false);
    }
  }, [hyped, hypePending, nowPlaying?.artistProfileId]);

  // The heart. POST saves, DELETE removes — `/api/fan-favorites` has no toggle,
  // so the method comes from the current state. Optimistic and reverted on
  // failure, same as HYPE: a heart left filled after a refused save tells the
  // viewer a track is in their library when it is not.
  const toggleFavourite = useCallback(async () => {
    const track = currentTrack;
    if (!track || favouritePending) return;
    const previous = favourited;
    setFavourited(!previous);
    setFavouritePending(true);
    try {
      // `mediaId` before `id`: the queue prefixes ids by source (`radio-<hexId>`)
      // so two entries for one asset do not collide, but the favourite has to key
      // on the ASSET or the same track saved from radio and from an artist page
      // becomes two rows that neither can un-save.
      const mediaId = track.mediaId ?? track.id;
      const res = previous
        ? await fetch('/api/fan-favorites', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaId }),
          })
        : await fetch('/api/fan-favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mediaId,
              title: track.title,
              artistName: track.artistName,
              url: track.url,
              artistProfileSlug: track.artistProfileSlug ?? null,
              artworkUrl: track.artworkUrl ?? null,
            }),
          });
      if (!res.ok) setFavourited(previous);
    } catch {
      setFavourited(previous);
    } finally {
      setFavouritePending(false);
    }
  }, [currentTrack, favourited, favouritePending]);

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
          canFavourite={canFavouriteTrack}
          canHype={canHype}
          canTogglePlay={Boolean(currentTrack)}
          favourited={favourited}
          hyped={hyped}
          onToggleFavourite={() => void toggleFavourite()}
          onToggleHype={() => void toggleHype()}
          onTogglePlay={togglePlayback}
          playing={Boolean(currentTrack) && isPlaying}
          track={displayTrack}
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
          /* Positioned in mmm.css, not here. Inline styles outrank every
             stylesheet rule, so hardcoding left/bottom made the logo the one
             piece of chrome the <=720px breakpoint could not move: the arc
             anchor shifted to 18/22 and the trigger stayed at 26/26, leaving
             the fan opening from a point offset from the button it belongs to.
             It also made the consent lift impossible to apply. */
          type="button"
        >
          <span>iHYPE</span>
          {isPlaying && currentTrack && (
            <span aria-hidden="true" className="mmm-eq"><span /><span /><span /></span>
          )}
        </button>

        {!navOpen && <div className="mmm-nav-hint">{navHint(pathname)}</div>}
      </div>
    </div>
  );
}
