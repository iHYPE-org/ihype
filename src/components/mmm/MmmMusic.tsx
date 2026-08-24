'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { useRouter } from 'next/navigation';
import { MmmSearch } from './MmmSearch';
import { useRegisterPlayIntent, useRegisterQueue } from '@/components/mmm/MmmPlayIntent';
import { toQueue, type PlayableRow } from '@/lib/mmm-play';
import { MmmSeedDeck, type MmmSeedItem } from './MmmSeedDeck';
import type { StationSummary } from '@/app/api/stations/route';

export type MusicTabId = 'discover' | 'radio' | 'charts' | 'recommended' | 'playlists' | 'library';

/**
 * The length of a Discover clip. The design system's range is 15–30 seconds and
 * `SeedDeck` defaults to 22; it is stated once here because the deck's ring and
 * the playback cut-off must agree — a ring that fills at a different rate from
 * the audio it describes is worse than no ring.
 */
const SEED_CLIP_SECONDS = 22;

type SeedCard = MmmSeedItem & {
  /** The playable track, for the clip. Null when the row carries no media. */
  url: string | null;
};
type ChartRow = { id: string; title: string; artistName: string; artistSlug: string; hypeCount: number; mediaUrl: string | null; artworkUrl: string | null };
type PlaylistRow = {
  id: string;
  name: string;
  count: number;
  /* The playlist's own tracks. `FanPlaylistItem` stores a fully playable row —
     url, title, artist, artwork — and `/api/fan-playlists` has always returned
     them; this type dropped the lot and kept a count, so the tab whose entire
     purpose is playlists could not play one. Same shape of bug as ChartsTab
     discarding `mediaUrl`. */
  items: PlayableRow[];
};
type StationTrackRow = {
  id: string;
  hexId: string;
  title: string;
  artistName: string;
  artistSlug: string;
  // Present in the endpoint's response and needed to actually play a station;
  // both are nullable in the underlying row.
  mediaUrl: string | null;
  artworkUrl: string | null;
};

/**
 * The radio filter chips, from the app-shell redesign — "Stations are
 * generated: by genre, new, local, recommended by others, and from a
 * listener's own history". These map one-to-one onto the station *kinds*
 * `/api/stations` already computes, so the chip is a filter over the real
 * station list rather than a second taxonomy.
 */
const RADIO_FILTERS: Array<{ id: string; label: string; kinds: string[] }> = [
  { id: 'genre', label: 'Genre', kinds: ['genre'] },
  { id: 'new', label: 'New', kinds: ['new'] },
  { id: 'local', label: 'Local', kinds: ['local'] },
  { id: 'others', label: 'From others', kinds: ['friends'] },
  { id: 'history', label: 'Your history', kinds: ['for_you'] },
];

/* Preview-only rows make empty local accounts useful for design review. They
   never enter an API response or the database, and every surface carrying
   them is visibly labelled DEMO CONTENT. Real rows always replace them.

   `mediaUrl: null` on every one is load-bearing now that the transport can
   start a list: `toQueue` drops a row with no audio, so the joystick cannot
   play demo content even on a surface that is showing it. A placeholder that
   could be played is a placeholder that will be. */
const DEMO_CHARTS: ChartRow[] = [
  { id: 'demo-chart-1', title: 'Neon Weather', artistName: 'Velvet Static', artistSlug: '', hypeCount: 2841, mediaUrl: null, artworkUrl: null },
  { id: 'demo-chart-2', title: 'Southbound Signals', artistName: 'June Arcade', artistSlug: '', hypeCount: 2317, mediaUrl: null, artworkUrl: null },
  { id: 'demo-chart-3', title: 'Borrowed Light', artistName: 'Harborline', artistSlug: '', hypeCount: 1986, mediaUrl: null, artworkUrl: null },
  { id: 'demo-chart-4', title: 'No Fixed Address', artistName: 'Mara North', artistSlug: '', hypeCount: 1642, mediaUrl: null, artworkUrl: null },
  { id: 'demo-chart-5', title: 'Glassroom', artistName: 'Afterimage Club', artistSlug: '', hypeCount: 1298, mediaUrl: null, artworkUrl: null },
  { id: 'demo-chart-6', title: 'Last Train Local', artistName: 'Citywide', artistSlug: '', hypeCount: 1044, mediaUrl: null, artworkUrl: null },
];

const DEMO_RECOMMENDED: StationTrackRow[] = [
  { id: 'demo-rec-1', hexId: '', title: 'Blue Hour Practice', artistName: 'North Common', artistSlug: '', mediaUrl: null, artworkUrl: null },
  { id: 'demo-rec-2', hexId: '', title: 'Open Late', artistName: 'The Side Streets', artistSlug: '', mediaUrl: null, artworkUrl: null },
  { id: 'demo-rec-3', hexId: '', title: 'Paper Satellites', artistName: 'Lena Vale', artistSlug: '', mediaUrl: null, artworkUrl: null },
  { id: 'demo-rec-4', hexId: '', title: 'Room Tone', artistName: 'Signal Fires', artistSlug: '', mediaUrl: null, artworkUrl: null },
  { id: 'demo-rec-5', hexId: '', title: 'Sunday Receiver', artistName: 'Low Current', artistSlug: '', mediaUrl: null, artworkUrl: null },
];

const DEMO_PLAYLISTS: PlaylistRow[] = [
  { id: 'demo-list-1', name: 'Saved from Discover', count: 18, items: [] },
  { id: 'demo-list-2', name: 'Portland After Dark', count: 12, items: [] },
  { id: 'demo-list-3', name: 'New Local Releases', count: 24, items: [] },
  { id: 'demo-list-4', name: 'Friday Show Shortlist', count: 7, items: [] },
];

/**
 * The MUSIC module — five tabs, each wired to a real endpoint.
 *
 * The tab is a ROUTE (`/app/music/radio`), not local state, per the handoff's
 * own note on state management. The strip below is therefore links, not
 * buttons: middle-click and back both work, which they did not in the prototype.
 *
 * Radio is **station-based, not DJ-hosted** — the key product change in this
 * handoff. Stations come from `GET /api/stations`, which computes each one at
 * request time; there is no station→track join table anywhere. The five filter
 * chips are the station *kinds*, not a second taxonomy.
 *
 * No emoji anywhere: the design system bans them outright ("expressiveness comes
 * from typographic contrast and color"). Unicode glyphs are fine.
 *
 * Every list here renders what the database returned. A tab with nothing in it
 * says so in a sentence rather than showing an empty frame, and a station whose
 * count could not be read renders without a count rather than claiming zero.
 */
export function MmmMusic({
  tab,
  genre,
  city,
  q,
  focusSearch = false,
}: { tab: MusicTabId; genre?: string; city?: string; q?: string; focusSearch?: boolean }) {
  return (
    <>
      {/* The tab strip that used to head this pane is gone: the module's
          destinations are tuned from the dial on the cabinet now, which is
          where the console direction puts them. Search stays here — it is not
          a destination, and it never was a tab. */}
      <div className="mmm-music-controls">
        <MmmSearch autoFocus={focusSearch} initialQuery={q ?? ''} />
      </div>
      {tab === 'discover' && <DiscoverTab city={city} genre={genre} />}
      {tab === 'radio' && <RadioTab />}
      {tab === 'charts' && <ChartsTab />}
      {tab === 'recommended' && <RecommendedTab />}
      {tab === 'playlists' && <PlaylistsTab />}
      {tab === 'library' && <LibraryTab />}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.6, padding: '10px 2px' }}>{children}</p>;
}

function Loading() {
  return <p className="mmm-eyebrow" role="status" style={{ padding: '10px 2px' }}>Loading…</p>;
}

function DemoHeader({ description }: { description: string }) {
  return (
    <div className="mmm-demo-head">
      <span className="mmm-demo-badge">Demo content</span>
      <p>{description}</p>
    </div>
  );
}

function useJson<T>(url: string, map: (payload: unknown) => T) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data: T | null }>({ status: 'loading', data: null });
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null });
    fetch(url, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload) => { if (!cancelled) setState({ status: 'ready', data: map(payload) }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', data: null }); });
    return () => { cancelled = true; };
    // `map` is defined inline by each caller; the URL is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return state;
}

/**
 * `genre` narrows the seed deck.
 *
 * It exists because search had nowhere honest to send a genre result. Legacy
 * sends them to `/listen?genre=`, which has been a redirect since row 273 and
 * drops the query — so those results have silently landed on an unfiltered
 * page. Pointing them at an MMM tab that also ignored the parameter would have
 * reproduced the same bug in the new shell rather than fixing it.
 *
 * `/api/discover/seeds` already takes `?genres=` (plural, comma-separated), so
 * this is a wire-through, not a new query.
 */
/**
 * Recently played, above the deck — "pick up where you left off".
 *
 * `MediaListen` has recorded every completed listen since launch and nothing
 * ever read it back for the listener; the rail is that history, most recent
 * first. Tapping a card plays the recents as a queue from that card. Silent
 * when empty, loading or failed — a rail is an extra, and an error banner for
 * an extra would outweigh the thing it decorates.
 */
function RecentsRail() {
  const { playTrack, currentTrack, isPlaying, togglePlayback } = useMediaPlayer();
  const { status, data } = useJson<PlayableRow[]>('/api/media-listens', (payload) =>
    ((payload as { recents?: PlayableRow[] }).recents ?? []));
  if (status !== 'ready' || !data || data.length === 0) return null;
  const queue = toQueue(data);
  if (queue.length === 0) return null;
  return (
    <div className="mmm-recents">
      <p className="mmm-eyebrow">Recently played</p>
      <div className="mmm-recents-rail">
        {queue.map((entry, index) => {
          const active = currentTrack?.id === entry.id;
          return (
            <button
              aria-label={active && isPlaying ? `Pause ${entry.title}` : `Play ${entry.title} by ${entry.artistName}`}
              className="mmm-recents-card"
              data-playing={active && isPlaying ? 'true' : undefined}
              key={entry.id}
              onClick={() => { if (active) togglePlayback(); else playTrack(entry, queue.slice(index).concat(queue.slice(0, index))); }}
              type="button"
            >
              <span aria-hidden="true" className="mmm-recents-art">
                {entry.artworkUrl
                  // eslint-disable-next-line @next/next/no-img-element -- uploader-sized remote artwork, same as the full player
                  ? <img alt="" src={entry.artworkUrl} />
                  : (entry.artistName || entry.title).charAt(0).toUpperCase()}
              </span>
              <span className="mmm-recents-title">{entry.title}</span>
              <span className="mmm-recents-sub">{entry.artistName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DiscoverTab({ genre, city }: { genre?: string; city?: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [hypedIds, setHypedIds] = useState<Set<string>>(() => new Set());
  const { currentTrack, currentTime, isPlaying, playTrack, togglePlayback } = useMediaPlayer();
  const trimmedGenre = genre?.trim() ?? '';
  const trimmedCity = city?.trim() ?? '';
  const seedsQuery = new URLSearchParams();
  // The endpoint's genre parameter is plural and comma-separated; one value is
  // a valid list of one.
  if (trimmedGenre) seedsQuery.set('genres', trimmedGenre);
  if (trimmedCity) seedsQuery.set('city', trimmedCity);
  const seedsUrl = seedsQuery.size
    ? `/api/discover/seeds?${seedsQuery.toString()}`
    : '/api/discover/seeds';
  const { status, data } = useJson<SeedCard[]>(seedsUrl, (payload) => {
    const seeds = (payload as { seeds?: Array<Record<string, unknown>> }).seeds ?? [];
    return seeds.map((seed) => {
      const artistName = String((seed.artistName as string) ?? (seed.profile as { name?: string })?.name ?? 'Unknown artist');
      const title = String(seed.title ?? 'Untitled');
      return {
        id: String(seed.id ?? ''),
        hexId: String(seed.hexId ?? ''),
        title,
        artistName,
        artistSlug: String((seed.artistSlug as string) ?? (seed.profile as { slug?: string })?.slug ?? ''),
        /* The release line under the track. The seeds endpoint carries genre
           and city, not an album — so this states what it actually knows
           rather than inventing a record the row has no column for. */
        album: [
          (seed.genre as string) ?? ((seed.profile as { genres?: string[] })?.genres ?? [])[0],
          (seed.city as string) ?? (seed.profile as { city?: string })?.city,
        ].filter(Boolean).join(' · '),
        /* Why this card is in the deck. The endpoint has always returned it and
           this surface used to drop it — ADHERENCE 36 makes stating it a rule,
           because a recommendation you cannot account for reads as an ad. */
        why: typeof seed.reason === 'string' && seed.reason ? seed.reason : 'In your seed mix',
        artworkUrl: typeof seed.artworkUrl === 'string' && seed.artworkUrl ? seed.artworkUrl : null,
        url: typeof seed.url === 'string' && seed.url ? seed.url : null,
        initial: (artistName || title).charAt(0).toUpperCase(),
      };
    });
  });

  /**
   * A verdict. All three actions are the same endpoint — it already accepts
   * save, skip and hype, and `save` is what writes the track into the Discover
   * playlist. The deck previously offered only hype and skip, so the design's
   * right-hand verdict had no implementation at all.
   *
   * The deck advances whatever the network does: a dropped gesture must not
   * strand the member on a card they have already judged.
   */
  const act = useCallback(async (seed: SeedCard, action: 'hype' | 'skip' | 'save') => {
    setBusy(true);
    if (action === 'hype') setHypedIds((ids) => new Set(ids).add(seed.id));
    if (action === 'save') setSavedCount((value) => value + 1);
    try {
      await fetch(`/api/discover/seeds/${seed.id}/${action}`, { method: 'POST' });
    } catch {
      // Intentionally swallowed — see above.
    } finally {
      setBusy(false);
      // HYPE is a verdict on the artist, not on the card: it stays put so the
      // member can still save or skip the track they just hyped.
      if (action !== 'hype') setIndex((value) => value + 1);
    }
  }, []);

  /**
   * The clip is a real clip: playback the deck started stops at
   * `SEED_CLIP_SECONDS`, which is what makes the ring above it mean anything.
   *
   * Two guards keep this contained to the deck's own playback. It only fires
   * while the current track is the card on screen — so a station or an album
   * started anywhere else in the shell is never cut off — and it pauses rather
   * than advancing, because the next card is the member's decision, not ours.
   *
   * Nothing auto-plays on arrival. A browser blocks unprompted audio without a
   * gesture anyway, so an auto-start would be a control that works on some
   * devices and silently does not on others.
   */
  /**
   * Play a card. Lifted out of the deck's own `onTogglePlay` so the DOCK can
   * start the same thing — see `useRegisterPlayIntent` below. It was inline
   * before, which is why the joystick had nothing to call.
   */
  /**
   * Play a card. Lifted out of the deck's own `onTogglePlay` so the DOCK can
   * start the same thing — see `useRegisterPlayIntent` below. It was an inline
   * arrow before, which is why the joystick had nothing it could call.
   */
  const playCard = useCallback((card: SeedCard) => {
    if (currentTrack?.id === card.id) {
      togglePlayback();
      return;
    }
    // No URL, nothing to play — the control is still drawn, because the card is
    // the same shape either way, and this is the one branch where it does
    // nothing. Send them to the track page instead of failing silently.
    if (!card.url) {
      router.push(`/app/tracks/${card.hexId}`);
      return;
    }
    playTrack({
      id: card.id,
      title: card.title,
      artistName: card.artistName,
      url: card.url,
      artistProfileSlug: card.artistSlug || null,
      artworkUrl: card.artworkUrl,
    });
  }, [currentTrack?.id, playTrack, router, togglePlayback]);

  /* Hand the dock's joystick something to start. Without this its tap is inert
     until a track has been loaded by some other control, which on this surface
     means the play button inside the card — so the transport looked unwired.

     The card ON SCREEN, resolved at call time through `index`: registering a
     captured track would go stale the first time the deck advanced. The intent
     is cleared when this pane unmounts (see MmmPlayIntent.tsx), so the joystick
     never starts a card from a surface the member has left. */
  const currentCard = (data ?? [])[index];
  useRegisterPlayIntent(
    useCallback(() => { if (currentCard) playCard(currentCard); }, [currentCard, playCard]),
  );

  const seedId = (data ?? [])[index]?.id;
  useEffect(() => {
    if (!seedId || currentTrack?.id !== seedId || !isPlaying) return;
    if (currentTime >= SEED_CLIP_SECONDS) togglePlayback();
  }, [currentTime, currentTrack?.id, isPlaying, seedId, togglePlayback]);

  // The active filter is always visible, and always clearable. A deck that is
  // quietly narrowed looks identical to a deck that has run out — which is the
  // shape of the bug this parameter exists to fix, just one step later.
  const activeFilterLabel = [
    trimmedGenre ? `Genre · ${trimmedGenre}` : null,
    trimmedCity ? `City · ${trimmedCity}` : null,
  ].filter(Boolean).join('  ·  ');
  const filterChip = activeFilterLabel ? (
    <div className="mmm-filter-chip">
      <span>{activeFilterLabel}</span>
      <Link href="/app/music/discover">Clear</Link>
    </div>
  ) : null;

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Discovery is unavailable right now. Radio and Charts still work.</Empty>;
  const seeds = data ?? [];
  const seed = seeds[index];
  if (!seed) {
    return (
      <>
        <RecentsRail />
        {filterChip}
        <Empty>
          {seeds.length === 0
            ? activeFilterLabel
              ? `Nothing matches that filter right now. Clear it, or try Radio.`
              : 'No seeds waiting — that usually means no new tracks near you yet. Try Radio, or a genre station.'
            : 'That is every seed for now. Come back tomorrow, or open Radio.'}
        </Empty>
      </>
    );
  }

  const clipPlaying = currentTrack?.id === seed.id && isPlaying;

  return (
    <>
      <RecentsRail />
      {filterChip}
      <MmmSeedDeck
        busy={busy}
        clipSeconds={SEED_CLIP_SECONDS}
        hyped={hypedIds.has(seed.id)}
        index={index}
        items={seeds}
        onHype={(item) => void act(item as SeedCard, 'hype')}
        onOpenArtist={(item) => router.push(
          item.artistSlug ? `/app/artists/${item.artistSlug}` : `/app/tracks/${item.hexId}`,
        )}
        onSave={(item) => void act(item as SeedCard, 'save')}
        onSkip={(item) => void act(item as SeedCard, 'skip')}
        onTogglePlay={(item) => playCard(item as SeedCard)}
        playing={clipPlaying}
        savedCount={savedCount}
      />
    </>
  );
}

/**
 * Stations play IN the shell, rather than navigating anywhere.
 *
 * What this replaces was not a styling problem. Every station row pushed
 * `/radio?station=<slug>` — and `/radio` takes no `searchParams` at all: it is
 * the always-on station and calls `getStationState()` with no argument. So the
 * Radio tab offered eight real choices (For you, Local, New, Friends, and the
 * genre stations) and all eight played the same thing. The selection was
 * decoration.
 *
 * The whole backend for it already existed and was reachable:
 * `GET /api/stations/[slug]/tracks` resolves a station through `stationWhere()`
 * and returns its ordered tracks. Nothing had ever called it.
 *
 * So the fix is not a link change and not a new pane — it is handing that queue
 * to the player the shell already carries. `playTrack(first, queue)` is the
 * same call `ArtistMediaPlaylist` makes, so the pill, the lock screen and the
 * skip controls all work with no further wiring, and the member never leaves
 * MUSIC to listen to music.
 */
function RadioTab() {
  const [filter, setFilter] = useState<string>('genre');
  const [pendingStation, setPendingStation] = useState<string | null>(null);
  const [stationError, setStationError] = useState<string | null>(null);
  const { playTrack } = useMediaPlayer();
  const { status, data } = useJson<StationSummary[]>(
    '/api/stations',
    (payload) => (payload as { stations?: StationSummary[] }).stations ?? [],
  );

  const openStation = useCallback(
    async (slug: string, title: string) => {
      setPendingStation(slug);
      setStationError(null);
      try {
        const response = await fetch(`/api/stations/${encodeURIComponent(slug)}/tracks`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { tracks?: StationTrackRow[] };
        /* `toQueue` is this mapping, moved to src/lib/mmm-play.ts so the chart,
           the recommended list and the dock's radio fallback share it — and
           share the filter that matters, which drops a row with no stored
           audio rather than stalling the player on a dead entry. */
        const queue = toQueue(payload.tracks ?? []);
        if (queue.length === 0) {
          setStationError(`${title} has no playable tracks yet.`);
          return;
        }
        playTrack(queue[0], queue);
      } catch {
        setStationError(`${title} could not be loaded. Try another station.`);
      } finally {
        setPendingStation(null);
      }
    },
    [playTrack],
  );

  /* The station the joystick starts here. The first in the CURRENT filter, not
     the first overall: the filter is what the member is looking at, so a tap
     should start what is on screen. Registered before the early returns below,
     because a hook cannot be called conditionally — with no data the callback
     simply has no station to open and the dock falls through to its own radio
     fallback. */
  const filtered = (data ?? []).filter((station) =>
    (RADIO_FILTERS.find((entry) => entry.id === filter) ?? RADIO_FILTERS[0]).kinds.includes(station.kind));
  const firstStation = filtered[0];
  useRegisterPlayIntent(useCallback(
    () => { if (firstStation) void openStation(firstStation.slug, firstStation.title); },
    [firstStation, openStation],
  ));

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Radio is paused right now. Charts and Discover still work.</Empty>;
  const all = data ?? [];
  if (!all.length) return <Empty>No stations are active yet.</Empty>;

  const active = RADIO_FILTERS.find((entry) => entry.id === filter) ?? RADIO_FILTERS[0];
  const stations = all.filter((station) => active.kinds.includes(station.kind));

  return (
    <>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 14 }}>
        {RADIO_FILTERS.map((entry) => (
          <button
            aria-pressed={entry.id === filter}
            className="mmm-chip mmm-chip-genre"
            key={entry.id}
            onClick={() => setFilter(entry.id)}
            style={{ backdropFilter: 'none' }}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>
      {stationError && <p className="mmm-me-note">{stationError}</p>}
      {stations.length === 0 && <Empty>No {active.label.toLowerCase()} station is active yet.</Empty>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {stations.map((station) => (
        <button
          className="mmm-row mmm-card mmm-station"
          data-playing="false"
          disabled={pendingStation === station.slug}
          key={station.slug}
          onClick={() => void openStation(station.slug, station.title)}
          style={{ borderBottom: '1px solid var(--hair-100)' }}
          type="button"
        >
          <span aria-hidden="true" className="mmm-station-art">▶︎</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="mmm-row-title" style={{ display: 'block' }}>{station.title}</span>
            <span className="mmm-row-sub" style={{ display: 'block' }}>{station.subtitle}</span>
          </span>
          {/* A null count means the query failed. Rendering "0 tracks" beside a
              station that may be full is worse than rendering nothing. */}
          {station.trackCount !== null && (
            <span className="mmm-row-meta" style={{ color: 'var(--ink-3)', fontSize: '0.9375rem', letterSpacing: '0.06em' }}>
              {station.trackCount} track{station.trackCount === 1 ? '' : 's'}
            </span>
          )}
        </button>
      ))}
      </div>
    </>
  );
}

/**
 * "Recommended" — tracks shared or hyped by accounts the viewer follows. This
 * is the `friends` station resolved through the real station endpoint rather
 * than a fourth recommendation path, so the taxonomy stays one taxonomy.
 */
function RecommendedTab() {
  const { status, data } = useJson<StationTrackRow[]>(
    '/api/stations/friends/tracks?limit=25',
    (payload) => ((payload as { tracks?: StationTrackRow[] }).tracks ?? []),
  );

  /* The whole list as one queue, started from the top by the joystick. These
     rows have always carried `mediaUrl` and this surface only ever linked to the
     track page with it, so a list of recommendations could be read and not
     heard.

     The ROWS stay links. Turning them into play buttons is a design change
     nothing has asked for, and the transport is the control this is about. */
  useRegisterQueue(data ?? []);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Recommendations are unavailable right now.</Empty>;
  const realTracks = data ?? [];
  const demo = realTracks.length === 0;
  const tracks = demo ? DEMO_RECOMMENDED : realTracks;

  return (
    <div className="mmm-music-list">
      {demo && <DemoHeader description="A preview of recommendations from artists and listeners you follow." />}
      {tracks.map((track) => (
        demo ? (
          <div aria-disabled="true" className="mmm-row mmm-demo-row" key={track.id}>
            <span className="mmm-demo-art" aria-hidden="true">{track.artistName.charAt(0)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{track.title}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{track.artistName}</span>
            </span>
            <span className="mmm-row-meta">From people you follow</span>
          </div>
        ) : <Link className="mmm-row" href={`/app/tracks/${track.hexId}`} key={track.id} style={{ display: 'flex' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="mmm-row-title" style={{ display: 'block' }}>{track.title}</span>
            <span className="mmm-row-sub" style={{ display: 'block' }}>{track.artistName}</span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
        </Link>
      ))}
    </div>
  );
}

function ChartsTab() {
  const { status, data } = useJson<ChartRow[]>('/api/charts', (payload) => {
    const groups = payload as { national?: Array<Record<string, unknown>> };
    return (groups.national ?? []).slice(0, 20).map((row) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? 'Untitled'),
      artistName: String(row.artistName ?? 'Unknown artist'),
      artistSlug: String(row.artistSlug ?? ''),
      hypeCount: Number(row.hypeCount ?? 0),
      /* `/api/charts` has always returned these and this mapping dropped them,
         so the chart was the one MUSIC surface with playable rows that could
         not be played at all — not a missing feature, a discarded field. */
      mediaUrl: typeof row.mediaUrl === 'string' && row.mediaUrl ? row.mediaUrl : null,
      artworkUrl: typeof row.artworkUrl === 'string' && row.artworkUrl ? row.artworkUrl : null,
    }));
  });

  // The chart from number one down. Rows stay links to the artist, as drawn.
  useRegisterQueue(data ?? []);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Charts are unavailable right now.</Empty>;
  const realRows = data ?? [];
  const demo = realRows.length === 0;
  const rows = demo ? DEMO_CHARTS : realRows;

  return (
    <div className="mmm-music-list">
      {demo && <DemoHeader description="A preview of the weekly chart once local HYPE activity can be ranked." />}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {rows.map((row, index) => (
        <li key={row.id}>
          {demo ? <div aria-disabled="true" className="mmm-row mmm-demo-row">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-3)', width: 22 }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{row.title}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{row.artistName}</span>
            </span>
            <span className="mmm-row-meta">{row.hypeCount.toLocaleString()} HYPE</span>
          </div> : <Link className="mmm-row" href={`/app/artists/${row.artistSlug}`} style={{ display: 'flex' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-3)', width: 22 }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{row.title}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{row.artistName}</span>
            </span>
            <span className="mmm-row-meta">{row.hypeCount.toLocaleString()}</span>
          </Link>}
        </li>
      ))}
      </ol>
    </div>
  );
}

type FavoriteRow = {
  mediaId: string;
  title: string;
  artistName: string;
  url: string;
  artistProfileSlug: string | null;
  artworkUrl: string | null;
};
type LikeRow = { targetType: 'ALBUM' | 'ARTIST' | 'VENUE' | 'ADVERTISEMENT'; targetId: string; name: string | null; slug: string | null; meta: string | null };

/**
 * LIBRARY — where the hearts land.
 *
 * Before this tab, a like went into the account and never came back out: the
 * player's heart wrote `FanFavoriteMedia` (a fully playable row — url, title,
 * artist, artwork) and the artist/venue hearts wrote `Like`, and no surface
 * anywhere listed either. This is also what makes the Settings copy true —
 * the HYPE link "shares liked playlists", and this list is the thing it shares.
 *
 * Liked tracks PLAY here — tapping a row starts the library from that row, and
 * the joystick starts it from the top — because a library you can only read is
 * the same bug one shelf up. Artists and venues stay links to their own pages.
 */
function LibraryTab() {
  const { playTrack, currentTrack, isPlaying, togglePlayback } = useMediaPlayer();
  const favorites = useJson<FavoriteRow[]>('/api/fan-favorites', (payload) =>
    ((payload as { favorites?: FavoriteRow[] }).favorites ?? []));
  const likes = useJson<LikeRow[]>('/api/likes', (payload) =>
    ((payload as { likes?: LikeRow[] }).likes ?? []));

  const tracks = favorites.data ?? [];
  /* `toQueue` addresses a row by hexId||id and favorites store the track's id
     as `mediaId` — without this mapping every liked row is silently dropped
     as unplayable and the whole library goes mute. */
  const playableTracks = tracks.map((row) => ({
    id: row.mediaId,
    title: row.title,
    artistName: row.artistName,
    artistSlug: row.artistProfileSlug,
    url: row.url,
    artworkUrl: row.artworkUrl,
  }));
  useRegisterQueue(playableTracks);

  if (favorites.status === 'loading' && likes.status === 'loading') return <Loading />;
  if (favorites.status === 'error' && likes.status === 'error') {
    return <Empty>Your library could not be read right now. Everything in it is safe.</Empty>;
  }

  const likedArtists = (likes.data ?? []).filter((row) => row.targetType === 'ARTIST' && row.name);
  const likedVenues = (likes.data ?? []).filter((row) => row.targetType === 'VENUE' && row.name);
  const empty = tracks.length === 0 && likedArtists.length === 0 && likedVenues.length === 0;

  const playFrom = (index: number) => {
    const queue = toQueue(playableTracks);
    /* The queue drops unplayable rows, so the tapped row's position in the
       QUEUE has to be found by identity, not assumed from the list index. */
    const target = queue.findIndex((entry) => entry.mediaId === tracks[index].mediaId);
    if (target < 0) return;
    if (currentTrack?.id === queue[target].id) { togglePlayback(); return; }
    playTrack(queue[target], queue);
  };

  if (empty) {
    return (
      <Empty>
        Nothing saved yet. The heart on the player saves a track here; the hearts on artist and venue
        pages save them here too — everything stays until you unlike it.
      </Empty>
    );
  }

  return (
    <div className="mmm-music-list">
      {tracks.length > 0 && (
        <>
          <p className="mmm-eyebrow" style={{ padding: '2px 2px 8px' }}>Liked tracks · {tracks.length}</p>
          {tracks.map((row, index) => {
            const active = currentTrack?.mediaId === row.mediaId || currentTrack?.id === row.mediaId;
            return (
              <button
                aria-label={active && isPlaying ? `Pause ${row.title}` : `Play ${row.title} by ${row.artistName}`}
                className="mmm-row"
                data-playing={active && isPlaying ? 'true' : undefined}
                key={row.mediaId}
                onClick={() => playFrom(index)}
                style={{ display: 'flex', width: '100%', textAlign: 'left' }}
                type="button"
              >
                <span aria-hidden="true" style={{ color: active && isPlaying ? 'var(--accent-text)' : 'var(--ink-3)', width: 22 }}>
                  {active && isPlaying ? '❚❚' : '▶︎'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="mmm-row-title" style={{ display: 'block' }}>{row.title}</span>
                  <span className="mmm-row-sub" style={{ display: 'block' }}>{row.artistName}</span>
                </span>
              </button>
            );
          })}
        </>
      )}
      {likedArtists.length > 0 && (
        <>
          <p className="mmm-eyebrow" style={{ padding: '14px 2px 8px' }}>Liked artists · {likedArtists.length}</p>
          {likedArtists.map((row) => (
            <Link className="mmm-row" href={row.slug ? `/app/artists/${row.slug}` : '/app/music/discover'} key={row.targetId} style={{ display: 'flex' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="mmm-row-title" style={{ display: 'block' }}>{row.name}</span>
                {row.meta && <span className="mmm-row-sub" style={{ display: 'block' }}>{row.meta}</span>}
              </span>
              <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
            </Link>
          ))}
        </>
      )}
      {likedVenues.length > 0 && (
        <>
          <p className="mmm-eyebrow" style={{ padding: '14px 2px 8px' }}>Liked venues · {likedVenues.length}</p>
          {likedVenues.map((row) => (
            <Link className="mmm-row" href={row.slug ? `/app/venues/${row.slug}` : '/app/map?layer=venues'} key={row.targetId} style={{ display: 'flex' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="mmm-row-title" style={{ display: 'block' }}>{row.name}</span>
                {row.meta && <span className="mmm-row-sub" style={{ display: 'block' }}>{row.meta}</span>}
              </span>
              <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

function PlaylistsTab() {
  const { status, data } = useJson<PlaylistRow[]>('/api/fan-playlists', (payload) => {
    const lists = (payload as { playlists?: Array<Record<string, unknown>> }).playlists ?? [];
    return lists.map((list) => ({
      id: String(list.id ?? ''),
      name: String(list.name ?? 'Playlist'),
      count: Array.isArray(list.items) ? list.items.length : Number(list.itemCount ?? 0),
      items: Array.isArray(list.items) ? (list.items as PlayableRow[]) : [],
    }));
  });

  /* The first playlist, played from the top. The first rather than a picked one
     because this is the joystick's fallback for the tab, not a per-row control:
     the rows link to each playlist's own page, and that page registers its own
     items (MmmPlayHere). */
  useRegisterQueue((data ?? [])[0]?.items ?? []);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Playlists are unavailable right now.</Empty>;
  const realLists = data ?? [];
  const demo = realLists.length === 0;
  const lists = demo ? DEMO_PLAYLISTS : realLists;

  // Each row links to its own playlist. /playlists never existed, so every
  // row used to point at the same dead URL. The real route is
  // /playlist/[slug], where the "slug" is the FanPlaylist id — page.tsx looks
  // it up with findUnique({ id }), and that id is exactly what
  // /api/fan-playlists returns.
  return (
    <div className="mmm-music-list">
      {demo && <DemoHeader description="A preview of personal and automatically assembled playlists." />}
      {lists.map((list) => (
        demo ? <div aria-disabled="true" className="mmm-row mmm-demo-row" key={list.id}>
          <span className="mmm-demo-art mmm-demo-playlist-art" aria-hidden="true">≡</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="mmm-row-title" style={{ display: 'block' }}>{list.name}</span>
            <span className="mmm-row-sub" style={{ display: 'block' }}>{list.count} tracks</span>
          </span>
          <span className="mmm-row-meta">Preview</span>
        </div> : <Link className="mmm-row" href={`/app/playlists/${list.id}`} key={list.id} style={{ display: 'flex' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="mmm-row-title" style={{ display: 'block' }}>{list.name}</span>
            <span className="mmm-row-sub" style={{ display: 'block' }}>{list.count} track{list.count === 1 ? '' : 's'}</span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
        </Link>
      ))}
    </div>
  );
}
