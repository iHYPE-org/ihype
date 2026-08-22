'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MmmDock } from '@/components/mmm/MmmDock';
import { MmmFullPlayer } from '@/components/mmm/MmmFullPlayer';
import { MmmMap, type MapLayer, type MapSheetTarget } from '@/components/mmm/MmmMap';
import { MmmSheet } from '@/components/mmm/MmmSheet';
import { MmmStationsProvider } from '@/components/mmm/MmmStations';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { isMmmDetailPath, moduleForPath } from '@/lib/mmm-nav';
import { formatHypeWait, hypeWaitUntil, HYPE_WINDOW_MS } from '@/lib/hype-window';
import { resolvePick, splitQueue } from '@/lib/mmm-queue';

/**
 * One row as the full player draws it. It used to live in `MmmPlayer.tsx` and
 * moved here when the pill retired — the shape is the shell's, and the full
 * player is now its only consumer.
 */
export type MmmPlayerTrack = {
  title: string;
  artist: string;
  initial: string;
  artworkUrl?: string | null;
  /** Shown after the artist as "artist · album" in the full player's meta line. */
  album?: string;
};

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
 * The Music · Map · Me frame, on the console dock.
 *
 * ## The contract
 *
 * 1. **No header, no tab bar, and now no arc.** The only persistent chrome is
 *    one walnut dock across the bottom carrying three controls — see
 *    `MmmDock.tsx`. The logo trigger, the radial arc, the nav hint, the scrim,
 *    the player pill and the phone mini-player are all retired (2026-08-22,
 *    owner decision: "I don't want any previous design … Bottom hifi nav system
 *    is the only thing I want"). Nothing they were wired to was dropped.
 * 2. **The map is the base layer and stays mounted.** Music and Me are panes
 *    over it, so returning to MAP keeps your pan and zoom. This component is
 *    rendered by the `/app` LAYOUT, which is the only place the App Router
 *    guarantees a subtree survives navigation.
 * 3. **Module, tab and view are routes, not state.** Only `sheet`, `fullOpen`,
 *    `queueOpen`, `faved` and `hyped` live here.
 * 4. **One dial per screen, and it is the dock's.** A page with its own section
 *    set registers it through `MmmStationsProvider` (mounted here) rather than
 *    drawing a selector of its own — the handoff's rule, because two
 *    identical-looking dials on one screen mean different things.
 * 5. One scroll container: the module pane. `html`/`body` are locked by
 *    `.mmm-locked`, which this component toggles.
 *
 * ## What the dock cost, deliberately
 *
 * There is no longer a persistent readout of what is playing: the dock is three
 * controls and no text, which is what the console template draws. The track,
 * the artist, the queue and the scrubber are one flick up (▲ on the joystick)
 * in `MmmFullPlayer`, which now opens at every width rather than on the phone
 * alone. That is a real trade and it is the design's.
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

  const [sheet, setSheet] = useState<MapSheetTarget | null>(null);
  const [hyped, setHyped] = useState(nowPlaying?.hyped ?? false);
  const [hypePending, setHypePending] = useState(false);
  /**
   * When this artist can be hyped again. The API already returns it on the
   * 429 it sends inside the window, and returned it to nobody: the pill and
   * the full player both accept `hypeLocked`/`hypeLabel` and neither was ever
   * given them, so a spent hype looked identical to an available one and the
   * only feedback was a refusal with no reason.
   */
  const [hypeNextAt, setHypeNextAt] = useState<string | null>(null);

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

  // Chrome that is anchored to the pill: the queue panel and the phone's
  // full-screen player.
  const [queueOpen, setQueueOpen] = useState(false);
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

  useEffect(() => {
    setQueueOpen(false);
    setFullOpen(false);
  }, [pathname]);

  // The hype heart resolves its target server-side, against `nowPlaying`. If
  // the audio element has since moved to a different track, that target is no
  // longer the artist on screen — so the heart is hidden rather than left
  // pointing at the wrong profile.
  const canHype = !currentTrack && Boolean(nowPlaying?.artistProfileId);

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
      // spent for this target, which is what the filled heart says. What it
      // also carries is WHEN — captured here so the controls can say it.
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as { nextHypeAt?: string } | null;
        if (body?.nextHypeAt) setHypeNextAt(body.nextHypeAt);
      } else if (!res.ok) {
        setHyped(false);
      } else {
        setHypeNextAt(new Date(Date.now() + HYPE_WINDOW_MS).toISOString());
      }
    } catch {
      setHyped(false);
    } finally {
      setHypePending(false);
    }
  }, [hyped, hypePending, nowPlaying?.artistProfileId]);

  // The window is per artist, so it resets with the artist rather than the
  // track: two songs by the same act share one hype.
  useEffect(() => {
    setHypeNextAt(null);
  }, [nowPlaying?.artistProfileId]);

  const hypeWait = hypeWaitUntil(hypeNextAt);
  const hypeLocked = hypeWait > 0;
  const hypeLabel = formatHypeWait(hypeWait);

  return (
    <MmmStationsProvider>
      <div className="mmm-frame">
        <MmmMap active={mapActive} initialLayer={initialMapLayer} onOpenSheet={setSheet} />

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

        {/* Every control the retired pill and mini-player carried — seek,
            volume, the heart, HYPE, the queue and the played list — lives here,
            wired to exactly the same endpoints as before. What changed is the
            way in: the joystick's ▲ opens it at EVERY width, where the phone
            was previously the only place it could be reached. */}
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
          hypeLabel={hypeLabel}
          hypeLocked={hypeLocked}
          onClose={() => setFullOpen(false)}
          onSearch={(query) => {
            setFullOpen(false);
            router.push(`/app/music/discover?q=${encodeURIComponent(query)}`);
          }}
          onNext={playNext}
          onOpenArtist={artistSlug ? () => { setFullOpen(false); router.push(`/app/artists/${artistSlug}`); } : undefined}
          onPickTrack={pickTrack}
          onPrev={playPrevious}
          onSeek={(value) => { if (duration > 0) seekTo((value / 100) * duration); }}
          onToggleFav={() => void toggleFav()}
          onToggleHype={() => void toggleHype()}
          onTogglePlay={togglePlayback}
          onVolume={(value) => setVolume(value / 100)}
          open={fullOpen}
          playing={Boolean(currentTrack) && isPlaying}
          progress={duration > 0 ? (currentTime / duration) * 100 : 0}
          queue={upNext}
          track={displayTrack}
          volume={volume * 100}
        />

        {/* The whole of the chrome. One walnut dock, three controls, every
            width — see MmmDock.tsx. `canTogglePlay` is false when there is no
            real track: a tap then does nothing, and the drag directions still
            work, which is the vendored component's own contract rather than a
            disabled control that looks broken. */}
        <MmmDock
          canTogglePlay={Boolean(currentTrack)}
          layer={requestedLayer ?? null}
          onCollapse={() => setFullOpen(false)}
          onExpand={() => setFullOpen(true)}
          onNext={playNext}
          onPrev={playPrevious}
          onTogglePlay={togglePlayback}
          pathname={pathname}
          playing={Boolean(currentTrack) && isPlaying}
        />
      </div>
    </MmmStationsProvider>
  );
}
