'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MmmArtistCard } from '@/components/mmm/MmmArtistCard';
import { MmmFullPlayer } from '@/components/mmm/MmmFullPlayer';
import { MmmMap, type MapLayer, type MapSheetTarget } from '@/components/mmm/MmmMap';
import { MmmNav } from '@/components/mmm/MmmNav';
import { MmmPlayer, type MmmPlayerTrack } from '@/components/mmm/MmmPlayer';
import { MmmSheet } from '@/components/mmm/MmmSheet';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { ARC_NARROW_MAX_WIDTH, isMmmDetailPath, itemForPath, moduleForPath, type MmmModuleId } from '@/lib/mmm-nav';
import { resolvePick, splitQueue } from '@/lib/mmm-queue';

export type MmmNowPlaying = {
  title: string;
  artist: string;
  initial: string;
  /**
   * The artist's profile id, or null when the artist cannot be hyped from here
   * — no linked profile, a non-discoverable one, or the viewer's own. The
   * layout resolves this server-side so the heart is never a control that is
   * guaranteed to fail.
   */
  artistProfileId: string | null;
  /**
   * The artist's public page, for the meta line's artist target. Null when the
   * track has no linked profile — the name then renders as plain text rather
   * than a link to nowhere.
   */
  artistSlug: string | null;
  /** Whether the viewer has hyped that profile inside the current 24h window. */
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
 *    guarantees a subtree survives navigation.
 * 3. **Module, tab and view are routes, not state.** The handoff says so
 *    explicitly. Only `navOpen`, `sheet`, `playing` and `hyped` live here.
 * 4. **Opening the nav dims everything, player included.** The player fades and
 *    drops out rather than being covered by the scrim, and the scrim sits above
 *    the map and the panes but below the fan.
 * 5. One scroll container: the module pane. `html`/`body` are locked by
 *    `.mmm-locked`, which this component toggles.
 */
export function MmmShell({
  children,
  nowPlaying,
  isAdmin = false,
}: {
  children: ReactNode;
  nowPlaying: MmmNowPlaying;
  isAdmin?: boolean;
}) {
  const pathname = usePathname() ?? '/app/map';
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeModule = moduleForPath(pathname);
  const activeItemId = itemForPath(pathname);
  /**
   * A detail surface (a show) renders as a pane even though `moduleForPath`
   * answers `map` for it — the map is where you reached it from, so the arc
   * keeps saying MAP, but the map itself stands down while it is open.
   */
  const detailOpen = isMmmDetailPath(pathname);
  const mapActive = activeModule === 'map' && !detailOpen;
  const requestedLayer = searchParams?.get('layer');
  const initialMapLayer: MapLayer =
    requestedLayer === 'venues' || requestedLayer === 'artists' ? requestedLayer : 'events';

  const [navOpen, setNavOpen] = useState(false);
  // Tapping the logo also wakes the player: on a wide screen it has usually
  // retired to its disc by then, and the logo is the one control always there.
  const [playerWake, setPlayerWake] = useState(0);
  const [sheet, setSheet] = useState<MapSheetTarget | null>(null);
  const [hyped, setHyped] = useState(nowPlaying?.hyped ?? false);
  const [hypePending, setHypePending] = useState(false);

  // Real playback, not local state. The pill used to own a `playing` boolean
  // that toggled nothing — DESIGN_SYNC row 268 open item (d). /app sits inside
  // AppProviders, so the same MediaPlayerProvider the rest of the site uses is
  // already overhead; the pill just was not reading it.
  const {
    canGoBack,
    canGoForward,
    currentIndex,
    currentTime,
    currentTrack,
    duration,
    isPlaying,
    playNext,
    playPrevious,
    playTrack,
    queue,
    seekTo,
    setVolume,
    togglePlayback,
    volume,
  } = useMediaPlayer();

  /**
   * Queue and history are ONE list split at the current index — what follows is
   * up next, what precedes is played, most recent first. The provider also
   * keeps a separate `history` array of listens; deriving both halves from the
   * queue instead is the design system's rule (ADHERENCE 27), and it is the
   * rule because two independently maintained arrays drift apart, leaving the
   * panel describing a queue that is not the one the player will actually play.
   */
  const toPanelTrack = useCallback((item: { title: string; artistName: string; artworkUrl?: string | null }): MmmPlayerTrack => ({
    title: item.title,
    artist: item.artistName,
    initial: (item.artistName || item.title).charAt(0).toUpperCase(),
    artworkUrl: item.artworkUrl ?? null,
  }), []);
  const split = splitQueue(queue, currentIndex);
  const upNext = split.upNext.map(toPanelTrack);
  const played = split.played.map(toPanelTrack);

  /**
   * Resolve a panel row back to the queue entry it was cut from. The panel
   * hands back which half it came from and the position inside that half, and
   * the arithmetic that inverts each slice lives here rather than in the
   * component — the component never sees the queue, only the two halves.
   */
  const pickTrack = useCallback((_row: MmmPlayerTrack, list: 'queue' | 'history', position: number) => {
    const target = resolvePick(queue, currentIndex, list, position);
    // Null means the row could not be resolved — a stale panel after the queue
    // moved under it. Doing nothing beats playing a neighbouring track.
    if (target) playTrack(target);
  }, [currentIndex, playTrack, queue]);

  // Chrome that is anchored to the pill: the queue panel, the artist highlight,
  // and the phone's full-screen player.
  const [queueOpen, setQueueOpen] = useState(false);
  const [artistOpen, setArtistOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);

  // The heart, which is NOT the HYPE control. SHELL_LOCK is explicit that they
  // are two acts: HYPE spends from your balance and moves the artist up the
  // local chart, the heart only saves the track. Collapsing them into one lost
  // the mechanic the product is named after, which is the state this shell was
  // in. `/api/fan-favorites` already existed to back it.
  const [faved, setFaved] = useState(false);
  const [favPending, setFavPending] = useState(false);

  // A track change invalidates the heart: it describes THIS track, and leaving
  // it lit would tell the member a song is saved when it is not.
  useEffect(() => {
    setFaved(false);
  }, [currentTrack?.id]);

  const toggleFav = useCallback(async () => {
    if (!currentTrack || favPending) return;
    const previous = faved;
    setFavPending(true);
    setFaved(!previous); // Optimistic: a heart that lags reads as a dropped tap.
    try {
      const response = previous
        ? await fetch(`/api/fan-favorites?mediaId=${encodeURIComponent(currentTrack.id)}`, { method: 'DELETE' })
        : await fetch('/api/fan-favorites', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              mediaId: currentTrack.id,
              title: currentTrack.title,
              artistName: currentTrack.artistName,
              url: currentTrack.url,
              artistProfileSlug: currentTrack.artistProfileSlug ?? null,
              artworkUrl: currentTrack.artworkUrl ?? null,
            }),
          });
      if (!response.ok) setFaved(previous);
    } catch {
      setFaved(previous);
    } finally {
      setFavPending(false);
    }
  }, [currentTrack, faved, favPending]);

  // Two different things can be shown here, and they are not interchangeable.
  // `currentTrack` is what the audio element actually holds. `nowPlaying` is a
  // server-resolved "your most recent listen" with no URL attached, so it can
  // be displayed but cannot be started. Prefer the real one whenever it exists.
  const displayTrack = currentTrack
    ? {
        title: currentTrack.title,
        artist: currentTrack.artistName,
        initial: (currentTrack.artistName || currentTrack.title).charAt(0).toUpperCase(),
        artworkUrl: currentTrack.artworkUrl ?? null,
      }
    : nowPlaying;

  /* The artist behind whatever the pill is showing. `currentTrack` wins when
     the audio element holds one, for the same reason `displayTrack` does — the
     highlight must describe the artist on screen, not the one from the last
     server render. Null when there is no linked profile: the name then stays
     plain text and the panel has no target to open. */
  const artistSlug = currentTrack ? currentTrack.artistProfileSlug ?? null : nowPlaying?.artistSlug ?? null;

  // Every panel anchored to the pill describes THIS track. A track change (or
  // opening the nav) invalidates all three rather than leaving them describing
  // something that is no longer playing.
  useEffect(() => {
    setArtistOpen(false);
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!navOpen) return;
    setQueueOpen(false);
    setArtistOpen(false);
  }, [navOpen]);

  useEffect(() => {
    setQueueOpen(false);
    setArtistOpen(false);
    setFullOpen(false);
  }, [pathname]);

  // The phone form of the pill drops prev/next, the heart and the volume track:
  // they do not fit beside a 64px square at 393px, and each is reachable
  // elsewhere. ARC_NARROW_MAX_WIDTH is the shell's own breakpoint, the one the
  // arc nav already switches at — a second threshold here would let the chrome
  // disagree with itself about how wide the frame is.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${ARC_NARROW_MAX_WIDTH}px)`);
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // The hype heart resolves its target server-side, against `nowPlaying`. If
  // the audio element has since moved to a different track, that target is no
  // longer the artist on screen — so the heart is hidden rather than left
  // pointing at the wrong profile.
  const canHype = !currentTrack && Boolean(nowPlaying?.artistProfileId);

  // Navigating closes the nav. There is no section to reset — the arc is one
  // level of three discs, per ArcNav.d.ts.
  useEffect(() => {
    setNavOpen(false);
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
  }, []);

  // The heart writes through to /api/hype — the same endpoint the artist
  // page's HypeButton posts to, so a hype tapped here counts once, in the same
  // place, and spends from the same balance.
  //
  // It is no longer a toggle: HYPE resets every 24 hours per target, so a
  // filled heart means "spent, and spendable again later", and tapping it
  // again inside the window does nothing rather than refunding. Optimistic,
  // then reverted on failure — leaving the heart filled after a refusal would
  // tell the viewer they spent a hype they still have.
  const toggleHype = useCallback(async () => {
    const profileId = nowPlaying?.artistProfileId;
    if (!profileId || hypePending || hyped) return;
    setHyped(true);
    setHypePending(true);
    try {
      const res = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'profile', targetId: profileId }),
      });
      // A 429 from the 24h window is not a failure to reflect: the hype IS
      // spent for this target, which is what the filled heart says.
      if (!res.ok && res.status !== 429) {
        setHyped(false);
      }
    } catch {
      setHyped(false);
    } finally {
      setHypePending(false);
    }
  }, [hyped, hypePending, nowPlaying?.artistProfileId]);

  const toggleNav = useCallback(() => {
    setSheet(null);
    setPlayerWake((value) => value + 1);
    setNavOpen((open) => !open);
  }, []);

  return (
    <div className="mmm-frame">
      <MmmMap active={mapActive && !navOpen} initialLayer={initialMapLayer} onOpenSheet={setSheet} />

      {!mapActive && (
        <div className="mmm-pane">
          {/* The migrated workflows already use the shared primitive aliases
              scoped beneath .mmm-migrated-surface. This nested surface
              activates those paint-only aliases without reviving any retired
              layout or chrome. */}
          <div className="mmm-migrated-surface">{children}</div>
        </div>
      )}

      {sheet && mapActive && <MmmSheet onClose={() => setSheet(null)} target={sheet} />}

      <div className="mmm-chrome">
        {/* The player fades and drops rather than unmounting, so its transition
            can play out — the design's `data-ih-hide` behaviour. Opening the nav
            still dims it completely, which was the explicit requirement. */}
        <MmmPlayer
          artistOpen={artistOpen}
          canFavourite={Boolean(currentTrack)}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          canHype={canHype}
          canTogglePlay={Boolean(currentTrack)}
          faved={faved}
          hidden={navOpen}
          history={played}
          hyped={hyped}
          narrow={narrow}
          /* Phone only: the artwork opens the full player, which is where the
             controls the phone bar drops actually live. */
          onExpand={() => { setNavOpen(false); setFullOpen(true); }}
          /* The name opens the highlight over the shell rather than navigating:
             the point is to decide about the artist without losing the map, the
             pane or your place in the queue. The panel itself carries the link
             out to the full artist page. */
          /* The two panels share one anchor above the pill, so opening either
             closes the other rather than stacking two dialogs on the same
             spot. */
          onOpenArtist={artistSlug ? () => { setQueueOpen(false); setArtistOpen((open) => !open); } : undefined}
          onPickTrack={pickTrack}
          onToggleQueue={() => { setArtistOpen(false); setQueueOpen((open) => !open); }}
          queue={upNext}
          queueOpen={queueOpen}
          wake={playerWake}
          /* The design's `openSearch` is module: music, tab: discover, field
             focused. There is no separate search surface to open — the field
             lives at the top of every MUSIC tab — so this is that navigation,
             and `focus=search` is what tells the field to take focus on
             arrival. Phone only; on a wider frame the field is already on
             screen whenever MUSIC is. */
          onSearch={() => router.push('/app/music/discover?focus=search')}
          onNext={playNext}
          onPrev={playPrevious}
          // The pill speaks 0-100; the audio element speaks seconds. Converted
          // here rather than in the component, so the component stays
          // presentation over whatever playback state it is given.
          onSeek={(value) => { if (duration > 0) seekTo((value / 100) * duration); }}
          onToggleFav={() => void toggleFav()}
          onToggleHype={() => void toggleHype()}
          onTogglePlay={togglePlayback}
          onVolume={(value) => setVolume(value / 100)}
          playing={Boolean(currentTrack) && isPlaying}
          progress={duration > 0 ? (currentTime / duration) * 100 : 0}
          track={displayTrack}
          volume={volume * 100}
        />

        {/* Anchored to the pill, so it is drawn beside it rather than inside
            it — the pill is a capsule and clips anything nested. */}
        {artistOpen && artistSlug && !navOpen && (
          <MmmArtistCard onClose={() => setArtistOpen(false)} slug={artistSlug} />
        )}

        {/* Phone only, and only over a real track: with nothing playing there
            is nothing to expand, and `onExpand` is the only way in. */}
        <MmmFullPlayer
          canFavourite={Boolean(currentTrack)}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          canHype={canHype}
          canTogglePlay={Boolean(currentTrack)}
          durationSeconds={duration}
          faved={faved}
          history={played}
          hyped={hyped}
          onClose={() => setFullOpen(false)}
          onNext={playNext}
          onOpenArtist={artistSlug ? () => { setFullOpen(false); router.push(`/app/artists/${artistSlug}`); } : undefined}
          onPickTrack={pickTrack}
          onPrev={playPrevious}
          onSeek={(value) => { if (duration > 0) seekTo((value / 100) * duration); }}
          onToggleFav={() => void toggleFav()}
          onToggleHype={() => void toggleHype()}
          onTogglePlay={togglePlayback}
          onVolume={(value) => setVolume(value / 100)}
          open={fullOpen && narrow}
          playing={Boolean(currentTrack) && isPlaying}
          progress={duration > 0 ? (currentTime / duration) * 100 : 0}
          queue={upNext}
          track={displayTrack}
          volume={volume * 100}
        />

        {/* ADMIN MODE was here and is gone (2026-08-14, from device
            screenshots). It was fixed top-right on every screen and covered
            the content underneath — the MUSIC tab strip, the MAP layer chips
            and a ME stat tile were all partly behind it. It also told an
            administrator something they already know: that they are one. The
            console is a drawer destination away, and `isAdmin` is still
            resolved in the layout for anything that genuinely needs it. */}

        {/* Always mounted: the arc animates between states, and unmounting it
            would make every open a fresh mount with no closing transition. */}
        <MmmNav
          activeModule={activeModule}
          onClose={closeNav}
          open={navOpen}
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
          {/* The full wordmark, per `components/shell/LogoTrigger.jsx`: iH, the
              bolt standing in for the Y, PE. It rendered as the plain word
              before, which lost the mark on the one square that is always on
              screen. Drawn inline rather than loaded from `assets/logo/` so it
              takes `currentColor` (`--ink-on-accent`) instead of shipping a
              second colour variant. */}
          <span className="mmm-logo-mark">
            <span>iH</span>
            <svg aria-hidden="true" viewBox="148 92 200 328">
              <path d="M280 96L152 288h96l-16 128 144-192h-96l16-128z" fill="currentColor" />
            </svg>
            <span>PE</span>
          </span>
          {isPlaying && currentTrack && (
            <span aria-hidden="true" className="mmm-eq"><span /><span /><span /></span>
          )}
        </button>

        {/* The module label that sat above the logo trigger ("MAP" / "MUSIC" /
            "ME") is gone (2026-08-14, from device screenshots). On a phone it
            printed over whatever the pane was showing at the bottom of the
            screen — the empty-state sentence on MUSIC, a ME row — and it names
            the module you are already looking at. The trigger itself is the
            navigation; the label was furniture. `navHint()` stays in
            `mmm-nav.ts` and stays tested: it is the arc's own labelling. */}
      </div>
    </div>
  );
}
