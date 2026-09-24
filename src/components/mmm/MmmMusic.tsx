'use client';

import { formatNumber } from '@/lib/format-locale';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMediaPlayer, useMediaPlayerClock } from '@/components/GlobalMediaPlayer';
import { useRouter } from 'next/navigation';
import { MmmSearch } from './MmmSearch';
import { useRegisterPlayIntent, useRegisterQueue } from '@/components/mmm/MmmPlayIntent';
import { ReleasePlayButton } from '@/components/profile/ReleasePlayButton';
import { toQueue, type PlayableRow } from '@/lib/mmm-play';
import { MmmShelf } from '@/components/mmm/MmmShelf';
import { MmmSeedDeck, type MmmSeedItem } from './MmmSeedDeck';
import type { StationSummary } from '@/app/api/stations/route';
import { MmmFreeUseCrate } from '@/components/mmm/MmmFreeUseCrate';
import { useI18n } from '@/components/I18nProvider';
import type { Translate } from '@/lib/mmm-shell-labels';
import { discoverSeedsUrl } from '@/lib/mmm-music-reads';

export type MusicTabId = 'discover' | 'radio' | 'charts' | 'recommended' | 'playlists';

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
type ChartRow = { id: string; title: string; artistName: string; artistSlug: string; hypeCount: number; mediaUrl: string | null; artworkUrl: string | null; loudnessLufs: number | null };
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
  /** Programme loudness, so the station levels between tracks. Nullable and
   *  optional for the same reason `reason` is: a response cached before the
   *  field existed must play, at unity. */
  loudnessLufs?: number | null;
  /** Why this track is in this station, for this viewer. Derived server-side
   *  from the same context the station was resolved with, so it cannot
   *  disagree with why the row qualified. Optional so a response cached before
   *  the field existed renders without one rather than printing "undefined". */
  reason?: string | null;
  /** Set only on an advertising break the station mixed into the rotation. A
   *  `mkt_` prefix is a real campaign and is what an impression is billed
   *  against; `toQueue` carries it through so the player can tell a paid spot
   *  from a song. */
  adClipId?: string | null;
  /** The server's receipt that this spot was served to this listener. Only a
   *  break carries one, and without it the impression route refuses to bill —
   *  see `src/lib/ad-play-token.ts`. */
  adPlayToken?: string | null;
};

/**
 * The radio filter chips, from the app-shell redesign — "Stations are
 * generated: by genre, new, local, recommended by others, and from a
 * listener's own history". These map one-to-one onto the station *kinds*
 * `/api/stations` already computes, so the chip is a filter over the real
 * station list rather than a second taxonomy.
 */
/**
 * The chip labels below are declared once, in English, because the filter's
 * KINDS and its label belong together. Translation happens at the draw, keyed
 * on that English — the same rule `mmm-shell-labels.ts` follows, and for the
 * same reason: every call has to be a literal `t('key', 'English')` or
 * `extract-i18n-keys.mjs` cannot see it and no translation could ever be
 * applied to it. `t(entry.labelKey, entry.label)` would be invisible to both
 * the extractor and the applier.
 */
function radioFilterLabel(t: Translate, label: string): string {
  switch (label) {
    case 'Genre': return t('mmmMusic.filterGenre', 'Genre');
    case 'New': return t('mmmMusic.filterNew', 'New');
    case 'Local': return t('mmmMusic.filterLocal', 'Local');
    case 'From others': return t('mmmMusic.filterFromOthers', 'From others');
    case 'Your history': return t('mmmMusic.filterYourHistory', 'Your history');
    default: return label;
  }
}

function chartLabel(t: Translate, label: string): string {
  switch (label) {
    case 'Area': return t('mmmMusic.chartArea', 'Area');
    case 'Genre': return t('mmmMusic.filterGenre', 'Genre');
    case 'Friends': return t('mmmMusic.chartFriends', 'Friends');
    case 'Local': return t('mmmMusic.filterLocal', 'Local');
    case 'Regional': return t('mmmMusic.chartRegional', 'Regional');
    case 'National': return t('mmmMusic.chartNational', 'National');
    case 'Global': return t('mmmMusic.chartGlobal', 'Global');
    default: return label;
  }
}

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
  { id: 'demo-chart-1', title: 'Neon Weather', artistName: 'Velvet Static', artistSlug: '', hypeCount: 2841, mediaUrl: null, artworkUrl: null, loudnessLufs: null },
  { id: 'demo-chart-2', title: 'Southbound Signals', artistName: 'June Arcade', artistSlug: '', hypeCount: 2317, mediaUrl: null, artworkUrl: null, loudnessLufs: null },
  { id: 'demo-chart-3', title: 'Borrowed Light', artistName: 'Harborline', artistSlug: '', hypeCount: 1986, mediaUrl: null, artworkUrl: null, loudnessLufs: null },
  { id: 'demo-chart-4', title: 'No Fixed Address', artistName: 'Mara North', artistSlug: '', hypeCount: 1642, mediaUrl: null, artworkUrl: null, loudnessLufs: null },
  { id: 'demo-chart-5', title: 'Glassroom', artistName: 'Afterimage Club', artistSlug: '', hypeCount: 1298, mediaUrl: null, artworkUrl: null, loudnessLufs: null },
  { id: 'demo-chart-6', title: 'Last Train Local', artistName: 'Citywide', artistSlug: '', hypeCount: 1044, mediaUrl: null, artworkUrl: null, loudnessLufs: null },
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
  initialPayloads = EMPTY_PAYLOADS,
}: {
  tab: MusicTabId;
  genre?: string;
  city?: string;
  q?: string;
  focusSearch?: boolean;
  /** The active tab's first reads, already answered by the server, and when (row 512). */
  initialPayloads?: InitialPayloads;
}) {
  return (
    <InitialPayloadsContext.Provider value={initialPayloads}>
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
    </InitialPayloadsContext.Provider>
  );
}

/**
 * Rows the SERVER read for this document, keyed by the URL the client would
 * fetch (`src/lib/mmm-music-bootstrap.ts`). They travel as props and are read
 * through this context, never written into `tabPayloadCache` on the server:
 * that Map is module-level, and on the server one module serves every
 * request the isolate takes, so a server-side write would hand one member's
 * rows to the next. The default is a frozen constant so an absent prop is a
 * stable reference, not a new object every render.
 */
type InitialPayloads = { at: number; payloads: Record<string, unknown> };
const EMPTY_PAYLOADS: InitialPayloads = Object.freeze({ at: 0, payloads: Object.freeze({}) });
const InitialPayloadsContext = createContext<InitialPayloads>(EMPTY_PAYLOADS);

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mmm-empty">{children}</p>;
}

function Loading() {
  const { t } = useI18n();
  /* The same plate the empty state uses, so a tab has ONE shape while it
     waits and when it has nothing — a fetching list and an empty list used to
     look like two different screens. `aria-busy` tells assistive tech the
     region is still filling. */
  return <p aria-busy="true" className="mmm-empty mmm-loading" role="status">{t('mmmMusic.loading', 'Loading…')}</p>;
}

function DemoHeader({ description }: { description: string }) {
  const { t } = useI18n();
  return (
    <div className="mmm-demo-head">
      <span className="mmm-demo-badge">{t('mmmMusic.demoContent', 'Demo content')}</span>
      <p>{description}</p>
    </div>
  );
}

/**
 * The tabs' payload cache — one per URL, module-level, so it outlives the tab.
 *
 * Every MUSIC tab used to fetch its rows AFTER mount, which put a second
 * round-trip behind every navigation. As of row 512 the SERVER answers each
 * tab's first reads inside the page render (`mmm-music-bootstrap.ts`) and
 * hands them down as `initialPayloads`, so the first render — streamed HTML
 * or RSC payload alike — already carries the rows. This cache is what keeps
 * the reads a tab makes AFTER that (a Charts dataset the member switches to,
 * a read the bootstrap missed) from being paid twice, on the same
 * stale-while-revalidate rule (`TAB_CACHE_TTL_MS`): a cached payload shows at
 * once and revalidates behind itself; a failed revalidation keeps what was on
 * screen; a first read that fails is still an error, never an empty claim
 * (row 408). Raw payloads are stored, never mapped ones — each caller maps
 * with its own closure. Row 509's sibling warmer (seven reads fired after
 * the active tab landed) is gone: the server's answer wins in `useJson`, so a
 * warmed payload would never have been read. (2026-09-23 · 2026-09-24,
 * DESIGN_SYNC rows 509 and 512.)
 */
const TAB_CACHE_TTL_MS = 60_000;

/* THE MEMBER'S OWN LIBRARY IS NEVER "FRESH FOR A MINUTE" (row 513). A rename,
   a delete, a heart, an add-to-playlist from the full player or the free-use
   crate all change these reads, from a dozen writers in five components; a
   60 s TTL — or a router replaying the page's server payload on Back — put the
   pre-write rows back on screen with nothing to correct them. Rather than ask
   every writer to remember an invalidation (the drift this repository keeps
   recording), these revalidate on every arrival once their reading is more
   than two seconds old: a fresh document load is not fetched twice, and a
   replayed or cached reading always is. Stations, charts and recommendations
   keep the minute. */
const OWN_LIBRARY_READS = ['/api/fan-favorites', '/api/likes', '/api/fan-playlists', '/api/media-listens'];
const OWN_LIBRARY_TTL_MS = 2_000;
function tabPayloadTtl(url: string): number {
  return OWN_LIBRARY_READS.some((prefix) => url === prefix || url.startsWith(`${prefix}?`))
    ? OWN_LIBRARY_TTL_MS
    : TAB_CACHE_TTL_MS;
}
const tabPayloadCache = new Map<string, { payload: unknown; at: number }>();
const tabPayloadInFlight = new Map<string, Promise<unknown>>();

function fetchTabPayload(url: string): Promise<unknown> {
  const pending = tabPayloadInFlight.get(url);
  if (pending) return pending;
  const request = fetch(url, { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((payload) => {
      tabPayloadCache.set(url, { payload, at: Date.now() });
      return payload;
    })
    .finally(() => { tabPayloadInFlight.delete(url); });
  tabPayloadInFlight.set(url, request);
  return request;
}

function useJson<T>(url: string, map: (payload: unknown) => T) {
  const initial = useContext(InitialPayloadsContext);
  const initialPayload = initial.payloads[url];
  const initialAt = initial.at;
  const cached = tabPayloadCache.get(url);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data: T | null }>(() =>
    // The server's own answer first — it is in the HTML, and reading it here
    // is what makes the hydration render match the streamed one. Then the
    // module cache (a client-side navigation), then the plate.
    initialPayload !== undefined
      ? { status: 'ready', data: map(initialPayload) }
      : cached
        ? { status: 'ready', data: map(cached.payload) }
        : { status: 'loading', data: null },
  );
  useEffect(() => {
    let cancelled = false;
    if (initialPayload !== undefined) {
      // The render carried this read. Seed the client's cache with it AT THE
      // MOMENT THE SERVER READ IT (this runs in the browser only — effects
      // never run on the server), show it, and revalidate only if that moment
      // is already outside the TTL — which is what a payload replayed from
      // the router cache 30 s later looks like. The rows stay on screen
      // either way; a failed revalidation changes nothing.
      const existing = tabPayloadCache.get(url);
      // A reading this browser took AFTER the server's (Back to a page whose
      // payload the router replays) is the newer one, so it is what shows.
      const newer = existing && existing.at > initialAt ? existing : null;
      if (!newer) tabPayloadCache.set(url, { payload: initialPayload, at: initialAt });
      const shownAt = newer ? newer.at : initialAt;
      setState({ status: 'ready', data: map(newer ? newer.payload : initialPayload) });
      if (Date.now() - shownAt < tabPayloadTtl(url) || tabPayloadInFlight.has(url)) {
        return () => { cancelled = true; };
      }
      fetchTabPayload(url)
        .then((payload) => { if (!cancelled) setState({ status: 'ready', data: map(payload) }); })
        .catch(() => { /* keep the server's rows */ });
      return () => { cancelled = true; };
    }
    const hit = tabPayloadCache.get(url);
    // A cached payload shows at once (even a stale one — it is the member's
    // own last reading, and the revalidation is already on the wire); an
    // uncached URL shows the plate.
    setState(hit ? { status: 'ready', data: map(hit.payload) } : { status: 'loading', data: null });
    if (hit && Date.now() - hit.at < tabPayloadTtl(url) && !tabPayloadInFlight.has(url)) {
      // Fresh enough: no request at all. Tab-to-tab inside the TTL is free.
      return () => { cancelled = true; };
    }
    fetchTabPayload(url)
      .then((payload) => { if (!cancelled) setState({ status: 'ready', data: map(payload) }); })
      .catch(() => {
        // Keep the rows that were on screen; a first read that failed is an error.
        if (!cancelled && !hit) setState({ status: 'error', data: null });
      });
    return () => { cancelled = true; };
    // `map` is defined inline by each caller; the URL (and the server's
    // payload for it, which changes only with the render that carried it)
    // are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, initialPayload, initialAt]);
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
  /* The rail this used to draw by hand is `MmmShelf` now — same behaviour, same
     queue, same play-or-pause on the current track. What it gains by being the
     shared primitive: the plate material every other surface uses, a real
     heading in the document outline, and the edge fade that only appears when
     there is something past the edge. */
  return (
    <MmmShelf
      heading="Recently played"
      tiles={queue.map((entry, index) => ({
        id: entry.id,
        title: entry.title,
        sub: entry.artistName,
        artworkUrl: entry.artworkUrl,
        active: currentTrack?.id === entry.id,
        label: currentTrack?.id === entry.id && isPlaying
          ? `Pause ${entry.title}`
          : `Play ${entry.title} by ${entry.artistName}`,
        onSelect: () => {
          if (currentTrack?.id === entry.id) { togglePlayback(); return; }
          playTrack(entry, queue.slice(index).concat(queue.slice(0, index)));
        },
      }))}
    />
  );
}

/* A deck card is a SEED_CLIP_SECONDS clip, not the whole track: this stops it
   there. It is its own component because it reads the playback clock, which
   ticks about four times a second, and that used to re-render the whole deck
   on every tick while a card played (2026-09-24, DESIGN_SYNC row 513). */
function SeedClipStop({ seedId }: { seedId: string }) {
  const { currentTrack, isPlaying, togglePlayback } = useMediaPlayer();
  const { currentTime } = useMediaPlayerClock();
  useEffect(() => {
    if (currentTrack?.id !== seedId || !isPlaying) return;
    if (currentTime >= SEED_CLIP_SECONDS) togglePlayback();
  }, [currentTime, currentTrack?.id, isPlaying, seedId, togglePlayback]);
  return null;
}

function DiscoverTab({ genre, city }: { genre?: string; city?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [hypedIds, setHypedIds] = useState<Set<string>>(() => new Set());
  // Which verdict did not land, if any. A save or a HYPE is applied to the
  // deck optimistically; when the route refuses it the state is put back and
  // this names what to press again. Cleared by the next verdict that lands.
  const [failed, setFailed] = useState<'hype' | 'save' | null>(null);
  const { currentTrack, isPlaying, playTrack, togglePlayback } = useMediaPlayer();
  const trimmedGenre = genre?.trim() ?? '';
  const trimmedCity = city?.trim() ?? '';
  // One builder for this URL: the page preloads exactly what this fetches.
  const seedsUrl = discoverSeedsUrl(genre, city);
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
   * Save and HYPE are applied optimistically and PUT BACK when the route
   * refuses them. Until 2026-09-14 the response was never read and the catch
   * was empty, so a save answered 404, 429 or 500 still counted "1 saved" and
   * the card advanced away with nothing in the Discover playlist, and a
   * refused HYPE lit the heart for the rest of the session — a control is a
   * promise that pressing it changed something (DESIGN_SYNC row 385).
   *
   * What still advances whatever the network does is SKIP: a skip has no
   * result to lose, and a dropped gesture must not strand the member on a
   * card they have already judged. A failed SAVE keeps the card, because
   * moving on would lose exactly the track the member asked to keep.
   */
  const act = useCallback(async (seed: SeedCard, action: 'hype' | 'skip' | 'save') => {
    setBusy(true);
    if (action === 'hype') setHypedIds((ids) => new Set(ids).add(seed.id));
    if (action === 'save') setSavedCount((value) => value + 1);
    let landed = false;
    try {
      const res = await fetch(`/api/discover/seeds/${seed.id}/${action}`, { method: 'POST' });
      landed = res.ok;
    } catch {
      landed = false;
    }
    if (!landed) {
      if (action === 'hype') {
        setHypedIds((ids) => {
          const next = new Set(ids);
          next.delete(seed.id);
          return next;
        });
      }
      if (action === 'save') setSavedCount((value) => Math.max(0, value - 1));
    }
    setFailed(landed ? null : action === 'skip' ? null : action);
    setBusy(false);
    // HYPE is a verdict on the artist, not on the card: it stays put so the
    // member can still save or skip the track they just hyped. A save that
    // did not land stays put too, so it can be pressed again.
    if (action === 'skip' || (action === 'save' && landed)) setIndex((value) => value + 1);
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
      /* The track's hexId, which is what gates the completion write in the
         player and what the listen route stores. Without it a clip that
         played to the end — a short track under the 22s cap — was heard and
         never counted (row 436). */
      mediaId: card.hexId,
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

  // The active filter is always visible, and always clearable. A deck that is
  // quietly narrowed looks identical to a deck that has run out — which is the
  // shape of the bug this parameter exists to fix, just one step later.
  const activeFilterLabel = [
    trimmedGenre ? `${t('mmmMusic.filterGenre', 'Genre')} · ${trimmedGenre}` : null,
    trimmedCity ? `${t('mmmMusic.filterCity', 'City')} · ${trimmedCity}` : null,
  ].filter(Boolean).join('  ·  ');
  const filterChip = activeFilterLabel ? (
    <div className="mmm-filter-chip">
      <span>{activeFilterLabel}</span>
      <Link href="/app/music/discover">{t('mmmMusic.clear', 'Clear')}</Link>
    </div>
  ) : null;

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>{t('mmmMusic.discoverUnavailable', 'Discovery is unavailable right now. Radio and Charts still work.')}</Empty>;
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
              ? t('mmmMusic.noSeedsForFilter', 'Nothing matches that filter right now. Clear it, or try Radio.')
              : t('mmmMusic.noSeeds', 'No seeds waiting — that usually means no new tracks near you yet. Try Radio, or a genre station.')
            : t('mmmMusic.seedsDone', 'That is every seed for now. Come back tomorrow, or open Radio.')}
        </Empty>
      </>
    );
  }

  const clipPlaying = currentTrack?.id === seed.id && isPlaying;

  return (
    <>
      <RecentsRail />
      {filterChip}
      <SeedClipStop seedId={seed.id} />
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
      {failed ? (
        <p className="mmm-deck-note" role="status">
          {failed === 'save'
            ? t('mmmMusic.saveDidNotLand', 'That save did not go through. The track is still here — try again.')
            : t('mmmMusic.hypeDidNotLand', 'That HYPE did not go through. Try again.')}
        </p>
      ) : null}
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
  const { t } = useI18n();
  const [filter, setFilter] = useState<string>('genre');
  const [pendingStation, setPendingStation] = useState<string | null>(null);
  /* The FACT, not the sentence. `openStation` is registered as the surface's
     play intent, so it has to keep a stable identity across renders — and `t`
     is redeclared on every render of the provider, which is exactly the loop
     `PagesHome` documents. Holding the station and the reason here lets the
     render do the wording without putting `t` in the callback's deps. */
  const [stationError, setStationError] = useState<{ title: string; reason: 'empty' | 'failed' } | null>(null);
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
          setStationError({ title, reason: 'empty' });
          return;
        }
        playTrack(queue[0], queue);
      } catch {
        setStationError({ title, reason: 'failed' });
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
  if (status === 'error') return <Empty>{t('mmmMusic.radioUnavailable', 'Radio is paused right now. Charts and Discover still work.')}</Empty>;
  const all = data ?? [];
  if (!all.length) return <Empty>{t('mmmMusic.noStations', 'No stations are active yet.')}</Empty>;

  const active = RADIO_FILTERS.find((entry) => entry.id === filter) ?? RADIO_FILTERS[0];
  const inFilter = all.filter((station) => active.kinds.includes(station.kind));
  /* A station with NOTHING in it is not a row (2026-09-23; owner: "do it", on
     the recommendation). Row 338 listed it disabled and saying so, on the
     reasoning that a station that vanishes reads as a fetch that failed — and
     that reasoning is about a FAILED read. Measured against the production
     catalogue the tab was eight disabled rows reading "No tracks yet" and not
     one thing to play, which is a list of nothing wearing a list's clothes. A
     count of zero is a read that SUCCEEDED, so the playable stations are the
     rows and the empty ones are folded under one sentence that NAMES them: the
     set is still on screen, nothing silently vanished, and a member reads once
     why the list is short. A null count is the failed read and stays a row —
     the tap finds out, and `stationError` says which way it went. */
  const stations = inFilter.filter((station) => station.trackCount !== 0);
  const waiting = inFilter.filter((station) => station.trackCount === 0);
  const waitingLine = waiting.length === 1
    ? t('mmmMusic.stationWaitingOne', '{name} fills as local artists upload.').replace('{name}', waiting[0].title)
    : t('mmmMusic.stationWaitingMany', '{count} stations fill as local artists upload: {names}.')
        .replace('{count}', String(waiting.length))
        .replace('{names}', waiting.map((station) => station.title).join(' · '));

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
            {radioFilterLabel(t, entry.label)}
          </button>
        ))}
      </div>
      {stationError && (
        <p className="mmm-me-note">
          {stationError.reason === 'empty'
            ? `${stationError.title} — ${t('mmmMusic.stationEmpty', 'no playable tracks yet.')}`
            : `${stationError.title} — ${t('mmmMusic.stationFailed', 'could not be loaded. Try another station.')}`}
        </p>
      )}
      {/* The filter is named by the pressed chip directly above, so the
          sentence does not interpolate a lowercased English label into itself
          — a construction no translator can follow. */}
      {inFilter.length === 0 && <Empty>{t('mmmMusic.noStationForFilter', 'No station is active yet for this filter.')}</Empty>}
      {/* Every station in the filter is waiting: ONE plate carrying the
          sentence, never an empty list above a note. */}
      {inFilter.length > 0 && stations.length === 0 && <Empty>{waitingLine}</Empty>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {stations.map((station) => (
        <button
          className="mmm-row mmm-card mmm-station"
          data-playing="false"
          disabled={pendingStation === station.slug}
          key={station.slug}
          onClick={() => void openStation(station.slug, station.title)}
          type="button"
        >
          <span aria-hidden="true" className="mmm-station-art">▶︎</span>
          <span className="mmm-station-main">
            <span className="mmm-row-title">{station.title}</span>
            <span className="mmm-row-sub">{station.subtitle}</span>
          </span>
          {/* A null count means the query failed. Rendering a figure beside a
              station that may be full is worse than rendering nothing. */}
          {station.trackCount !== null && (
            <span className="mmm-row-meta mmm-station-count">
              {`${station.trackCount} ${station.trackCount === 1 ? t('mmmMusic.trackOne', 'track') : t('mmmMusic.trackMany', 'tracks')}`}
            </span>
          )}
        </button>
      ))}
      </div>
      {stations.length > 0 && waiting.length > 0 && (
        <p className="mmm-me-note">{waitingLine}</p>
      )}
    </>
  );
}

/**
 * "Recommended" — the multi-signal recommender (`src/lib/recommendations.ts`)
 * through `GET /api/recommend`: one playable track per recommended artist,
 * each with the engine's own reason.
 *
 * Until 2026-09-01 this read the `friends` station (tracks from artists the
 * viewer follows), which is a filter, and showed a DEMO preview when that was
 * empty. Both are gone here by the owner's rule — "will say nothing yet until
 * something makes sense" — so a viewer who has not yet hyped, followed, saved
 * or asked a venue for anyone sees an empty state that says what will start
 * it, and never a placeholder dressed as a recommendation. The `friends`
 * station itself is still in the Radio tab's station list.
 */
type RecommendPayload = { ready: boolean; tracks: StationTrackRow[] };

function RecommendedTab() {
  const { t } = useI18n();
  const { status, data } = useJson<RecommendPayload>(
    '/api/recommend',
    (payload) => {
      const body = payload as { ready?: boolean; tracks?: StationTrackRow[] };
      return { ready: Boolean(body.ready), tracks: body.tracks ?? [] };
    },
  );

  /* The whole list as one queue. These rows have always carried `mediaUrl`
     and this surface only ever linked to the track page with it, so a list of
     recommendations could be read and not heard; the registration below was
     the fix, consumed by the dock's transport.

     The ROWS stay links. But the cold-start transport left the bar with the
     MIDDLE ROAD (row 341), so with nothing loaded this registration has no
     consumer and a member had NO way to start a recommended track from here —
     found on 2026-09-14 by the shell spec's transport test the first time it
     ran (row 434). Each row now carries the same play key the artist page's
     release rows carry (`ReleasePlayButton`, row 352): outside the link, so a
     button never sits inside an anchor, and it plays the row inside the whole
     list so the mini player's next/previous mean something. The registration
     stays for the mini player's key once something is loaded. */
  useRegisterQueue(data?.tracks ?? []);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>{t('mmmMusic.recommendUnavailable', 'Recommendations are unavailable right now.')}</Empty>;
  if (!data?.ready) {
    return (
      <Empty>
        {t('mmmMusic.recommendNotReady', 'Recommendations start once you hype an artist, follow one, save something from the deck, or ask a venue to book someone. Nothing here is guessed.')}
      </Empty>
    );
  }
  const tracks = data.tracks;
  if (tracks.length === 0) {
    return <Empty>{t('mmmMusic.recommendNothingNew', 'Nothing to recommend yet beyond what you already know. Check back as more artists release music.')}</Empty>;
  }

  return (
    <div className="mmm-music-list">
      {tracks.map((track) => (
        <div className="profile-release-entry" key={track.id}>
          <Link className="mmm-row" href={`/app/tracks/${track.hexId}`} style={{ display: 'flex' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{track.title}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{track.artistName}</span>
              {/* The WHY. A recommendation a listener cannot account for reads as
                  an advert; this is the endpoint's own derivation, not a guess
                  made here, so it cannot disagree with why the row qualified. */}
              {/* Secondary ink, not the accent: five rows of red reason lines read as
      five warnings (2026-09-22). The accent is for the current or actionable
      item, and a reason is neither. */}
                {track.reason && <span className="mmm-row-sub" style={{ display: 'block', color: 'var(--ink-3)' }}>{track.reason}</span>}
            </span>
            <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
          </Link>
          <ReleasePlayButton label={track.title} rows={tracks} track={track} />
        </div>
      ))}
    </div>
  );
}

/**
 * CHARTS IS THREE DATASETS (owner, 2026-08-25: "charts are 3 different
 * datasets"), and the endpoint answers one at a time.
 *
 * - AREA ranks the same music at four widths — local, regional, national,
 *   global. The scope is a zoom, so it is a second row of chips under one
 *   dataset rather than three more datasets.
 * - GENRE ranks one genre across everywhere. Its chips come from the response,
 *   so a chip can never lead to an empty chart.
 * - FRIENDS ranks only accounts the viewer follows — the same definition the
 *   `friends` radio station already uses (`src/lib/stations.ts`), because two
 *   surfaces answering "your friends" differently is worse than either answer.
 *
 * Chips rather than a dial: the dock's dial carries the MUSIC tab strip, and
 * the handoff allows exactly one dial per screen. The radio tab's filter row is
 * the precedent.
 */
const CHART_DATASETS = [
  { id: 'area', label: 'Area' },
  { id: 'genre', label: 'Genre' },
  { id: 'friends', label: 'Friends' },
] as const;

const CHART_SCOPES = [
  { id: 'local', label: 'Local' },
  { id: 'regional', label: 'Regional' },
  { id: 'national', label: 'National' },
  { id: 'global', label: 'Global' },
] as const;

type ChartDatasetId = typeof CHART_DATASETS[number]['id'];
type ChartScopeId = typeof CHART_SCOPES[number]['id'];

type ChartPayload = {
  rows: ChartRow[];
  genres: string[];
  viewerPlace: { city: string | null; region: string | null; country: string | null };
  reason: string | null;
};

/** What an empty chart MEANS. Every one of these is a different situation and
 *  three of them are actionable, so a single "nothing here" would be the least
 *  useful sentence available. */
function emptyChartMessage(t: Translate, reason: string | null, dataset: ChartDatasetId, scope: ChartScopeId): string {
  if (reason === 'no-follows') return t('mmmMusic.chartNoFollows', 'You are not following anyone yet. Follow an artist or a venue and their music charts here.');
  if (reason === 'no-location') {
    return scope === 'local'
      ? t('mmmMusic.chartNoCity', 'Add a city to your profile and the local chart will follow it.')
      : t('mmmMusic.chartNoLocation', 'Add a location to your profile and this chart will follow it.');
  }
  if (reason === 'no-genre') return t('mmmMusic.chartPickGenre', 'Pick a genre.');
  if (reason === 'no-tracks') return t('mmmMusic.chartNoReleases', 'No released music here yet.');
  if (dataset === 'friends') return t('mmmMusic.chartNoFriendHypes', 'Nothing you follow has been hyped this week.');
  return t('mmmMusic.chartNoHypes', 'Nothing here has been hyped this week.');
}

function ChartsTab() {
  const { locale, t } = useI18n();
  const [dataset, setDataset] = useState<ChartDatasetId>('area');
  const [scope, setScope] = useState<ChartScopeId>('local');
  const [genre, setGenre] = useState('');

  const query = dataset === 'area'
    ? `/api/charts?dataset=area&scope=${scope}`
    : dataset === 'genre'
      ? `/api/charts?dataset=genre&genre=${encodeURIComponent(genre)}`
      : '/api/charts?dataset=friends';

  const { status, data } = useJson<ChartPayload>(query, (payload) => {
    const body = payload as {
      rows?: Array<Record<string, unknown>>;
      genres?: unknown;
      viewerPlace?: { city?: unknown; region?: unknown; country?: unknown };
      reason?: unknown;
    };
    return {
      rows: (body.rows ?? []).map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? 'Untitled'),
        artistName: String(row.artistName ?? 'Unknown artist'),
        artistSlug: String(row.artistSlug ?? ''),
        hypeCount: Number(row.hypeCount ?? 0),
        /* `/api/charts` has always returned these and an earlier mapping
           dropped them, so the chart was the one MUSIC surface with playable
           rows that could not be played at all — not a missing feature, a
           discarded field. */
        mediaUrl: typeof row.mediaUrl === 'string' && row.mediaUrl ? row.mediaUrl : null,
        artworkUrl: typeof row.artworkUrl === 'string' && row.artworkUrl ? row.artworkUrl : null,
        loudnessLufs: typeof row.loudnessLufs === 'number' ? row.loudnessLufs : null,
      })),
      genres: Array.isArray(body.genres) ? body.genres.map(String) : [],
      viewerPlace: {
        city: typeof body.viewerPlace?.city === 'string' ? body.viewerPlace.city : null,
        region: typeof body.viewerPlace?.region === 'string' ? body.viewerPlace.region : null,
        country: typeof body.viewerPlace?.country === 'string' ? body.viewerPlace.country : null,
      },
      reason: typeof body.reason === 'string' ? body.reason : null,
    };
  });

  const rows = data?.rows ?? [];
  // The chart from number one down. Rows stay links to the artist, as drawn.
  useRegisterQueue(rows);

  /* The scope chip says WHERE it is ranking, when the viewer's profile knows.
     "Local" alone is a label; "Local · Portland" is a readout. */
  const scopeDetail = dataset === 'area'
    ? scope === 'local' ? data?.viewerPlace.city
      : scope === 'regional' ? data?.viewerPlace.region
      : scope === 'national' ? data?.viewerPlace.country
      : null
    : null;

  const chips = (
    <>
      <div className="mmm-chart-chips">
        {CHART_DATASETS.map((entry) => (
          <button
            aria-pressed={entry.id === dataset}
            className="mmm-chip mmm-chip-genre"
            key={entry.id}
            onClick={() => setDataset(entry.id)}
            style={{ backdropFilter: 'none' }}
            type="button"
          >
            {chartLabel(t, entry.label)}
          </button>
        ))}
      </div>
      {dataset === 'area' && (
        <div className="mmm-chart-chips">
          {CHART_SCOPES.map((entry) => (
            <button
              aria-pressed={entry.id === scope}
              className="mmm-chip mmm-chip-genre"
              key={entry.id}
              onClick={() => setScope(entry.id)}
              style={{ backdropFilter: 'none' }}
              type="button"
            >
              {chartLabel(t, entry.label)}
            </button>
          ))}
        </div>
      )}
      {dataset === 'genre' && (data?.genres.length ?? 0) > 0 && (
        <div className="mmm-chart-chips">
          {(data?.genres ?? []).map((entry) => (
            <button
              aria-pressed={entry === genre}
              className="mmm-chip mmm-chip-genre"
              key={entry}
              onClick={() => setGenre(entry === genre ? '' : entry)}
              style={{ backdropFilter: 'none' }}
              type="button"
            >
              {entry}
            </button>
          ))}
        </div>
      )}
      {scopeDetail && <p className="mmm-chart-place">{t('mmmMusic.ranking', 'Ranking')} {scopeDetail}</p>}
    </>
  );

  if (status === 'error') {
    return (
      <div className="mmm-music-list">
        {chips}
        <Empty>{t('mmmMusic.chartsUnavailable', 'Charts are unavailable right now.')}</Empty>
      </div>
    );
  }

  /* Demo rows only stand in for the GLOBAL chart with nothing hyped anywhere.
     A narrower dataset that is empty is telling the truth about this account —
     no follows, no city, a quiet genre — and filling it with invented rows
     would answer a real question with a fiction. */
  const demo = status === 'ready' && rows.length === 0 && dataset === 'area' && scope === 'global';
  const shown = demo ? DEMO_CHARTS : rows;

  return (
    <div className="mmm-music-list">
      {chips}
      {status === 'loading' && <Loading />}
      {status === 'ready' && rows.length === 0 && !demo && (
        <Empty>{emptyChartMessage(t, data?.reason ?? null, dataset, scope)}</Empty>
      )}
      {demo && <DemoHeader description={t('mmmMusic.chartDemoNote', 'A preview of the weekly chart once HYPE activity can be ranked.')} />}
      {shown.length > 0 && (
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {shown.map((row, index) => (
        <li key={row.id}>
          {demo ? <div aria-disabled="true" className="mmm-row mmm-demo-row">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-3)', width: 22 }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{row.title}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{row.artistName}</span>
            </span>
            <span className="mmm-row-meta">{formatNumber(locale, row.hypeCount)} HYPE</span>
          </div> : <div className="profile-release-entry">
            {/* The row links to the ACT (a chart ranks artists' tracks by hype);
                the key beside it plays the track inside the whole chart, so
                next/previous walk the ranking. Until 2026-09-14 the rows were
                the only control and the chart was startable solely through the
                dock's registered queue — a consumer the MIDDLE ROAD (row 341)
                left with nothing to press over silence. Row 434. */}
            <Link className="mmm-row" href={`/app/artists/${row.artistSlug}`} style={{ display: 'flex' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-3)', width: 22 }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="mmm-row-title" style={{ display: 'block' }}>{row.title}</span>
                <span className="mmm-row-sub" style={{ display: 'block' }}>{row.artistName}</span>
              </span>
              <span className="mmm-row-meta">{formatNumber(locale, row.hypeCount)}</span>
            </Link>
            <ReleasePlayButton label={row.title} rows={shown} track={row} />
          </div>}
        </li>
      ))}
      </ol>
      )}
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

type StationRow = { slug: string; title: string; subtitle: string; trackCount: number | null };

/** One playable liked-track row. Extracted because the same row now appears
 *  under Playlists rather than in a tab of its own. */
function TrackRow({ row, active, playing, onPlay }: {
  row: FavoriteRow; active: boolean; playing: boolean; onPlay: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      aria-label={active && playing
        ? `${t('mmmMusic.pause', 'Pause')} ${row.title}`
        : `${t('mmmMusic.play', 'Play')} ${row.title} — ${row.artistName}`}
      className="mmm-row"
      data-playing={active && playing ? 'true' : undefined}
      onClick={onPlay}
      style={{ display: 'flex', width: '100%', textAlign: 'left' }}
      type="button"
    >
      <span aria-hidden="true" style={{ color: active && playing ? 'var(--accent-text)' : 'var(--ink-3)', width: 22 }}>
        {active && playing ? '❚❚' : '▶︎'}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="mmm-row-title" style={{ display: 'block' }}>{row.title}</span>
        <span className="mmm-row-sub" style={{ display: 'block' }}>{row.artistName}</span>
      </span>
    </button>
  );
}

/** A profile the member liked. Artists and venues read identically; only the
 *  route differs, so one component takes both. */
function LikedProfileRows({ rows, heading, hrefFor }: {
  rows: LikeRow[]; heading: string; hrefFor: (row: LikeRow) => string;
}) {
  const { t } = useI18n();
  /* A shelf, not rows (MIDDLE ROAD, 2026-09-04). An artist and a venue are
     COLLECTIONS — one object with an identity — which is the half of the
     library that shelves; the liked TRACKS above stay a vertical list, because
     fifty of them behind a horizontal scroll is strictly worse than a list. No
     `LikeRow` carries an image, so every tile takes the deterministic walnut
     fallback, which at alpha is what almost every tile is anyway. */
  return (
    <MmmShelf
      count={rows.length}
      heading={heading}
      tiles={rows.map((row) => ({
        id: row.targetId,
        title: row.name ?? t('mmmMusic.unnamed', 'Unnamed'),
        sub: row.meta,
        href: hrefFor(row),
      }))}
    />
  );
}

/**
 * One of the member's own playlists, with the two controls it never had.
 *
 * Rename is inline rather than a prompt() — a modal dialog is unstyleable and
 * some WebViews suppress it outright, so the one place a name can be corrected
 * would have been silently dead on a phone. Delete is two-tap: a playlist is
 * real work to rebuild and a single destructive tap beside a navigation row is
 * a mis-tap waiting to happen. Neither is optimistic — the row changes only
 * once the server has said so, because a rename that appears to work and did
 * not is worse than one that visibly failed.
 */
function OwnPlaylistRow({ list, onRenamed, onDeleted }: {
  list: PlaylistRow; onRenamed: (name: string) => void; onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'idle' | 'rename' | 'confirm'>('idle');
  const [draft, setDraft] = useState(list.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rename = async () => {
    const name = draft.trim();
    if (!name || name === list.name) { setMode('idle'); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/fan-playlists/${list.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(String(response.status));
      onRenamed(name);
      setMode('idle');
    } catch {
      setError(t('mmmMusic.renameFailed', 'That name could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/fan-playlists/${list.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(String(response.status));
      onDeleted();
    } catch {
      setError(t('mmmMusic.deleteFailed', 'That playlist could not be deleted.'));
      setBusy(false);
      setMode('idle');
    }
  };

  if (mode === 'rename') {
    return (
      <div className="mmm-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          aria-label={`${t('mmmMusic.rename', 'Rename')} ${list.name}`}
          autoFocus
          className="mmm-row-title"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void rename(); if (event.key === 'Escape') setMode('idle'); }}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--ink)' }}
          value={draft}
        />
        <button className="mmm-btn-ghost" disabled={busy} onClick={() => void rename()} type="button">{t('mmmMusic.save', 'Save')}</button>
        <button className="mmm-btn-ghost" disabled={busy} onClick={() => { setDraft(list.name); setMode('idle'); }} type="button">{t('mmmMusic.cancel', 'Cancel')}</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="mmm-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link className="mmm-row-link" href={`/app/playlists/${list.id}`}>
          <span className="mmm-row-title">{list.name}</span>
          <span className="mmm-row-sub">{list.count} {list.count === 1 ? t('mmmMusic.trackOne', 'track') : t('mmmMusic.trackMany', 'tracks')}</span>
        </Link>
        {mode === 'confirm' ? (
          <>
            <button className="mmm-btn-ghost" disabled={busy} onClick={() => void remove()} type="button">{t('mmmMusic.delete', 'Delete')}</button>
            <button className="mmm-btn-ghost" disabled={busy} onClick={() => setMode('idle')} type="button">{t('mmmMusic.keep', 'Keep')}</button>
          </>
        ) : (
          <>
            <button aria-label={`${t('mmmMusic.rename', 'Rename')} ${list.name}`} className="mmm-btn-ghost" onClick={() => setMode('rename')} type="button">{t('mmmMusic.rename', 'Rename')}</button>
            <button aria-label={`${t('mmmMusic.delete', 'Delete')} ${list.name}`} className="mmm-btn-ghost" onClick={() => setMode('confirm')} type="button">{t('mmmMusic.delete', 'Delete')}</button>
          </>
        )}
      </div>
      {error && <p className="mmm-eyebrow" role="status" style={{ color: 'var(--danger-text)', padding: '0 2px 8px' }}>{error}</p>}
    </div>
  );
}

/**
 * PLAYLISTS — every collection the member has, in one place.
 *
 * This absorbed the LIBRARY tab (owner, 2026-08-25: "Remove library as it's
 * already contained in playlists"). Library's whole content moved here rather
 * than going with the tab: liked tracks, liked artists and liked venues are the
 * same rows in the same markup, because a like that goes into the account and
 * never comes back out is the exact bug Library was built to fix, and deleting
 * the surface would have re-opened it.
 *
 * Four sections, in the order a member cares about them:
 *   Liked tracks            — playable, tap to start from that row
 *   Your playlists          — with rename and delete, which nothing offered
 *   Automatically assembled — the eight computed stations, the "discover" half
 *   Liked artists / venues  — links to their pages
 */
function PlaylistsTab() {
  const { t } = useI18n();
  const { playTrack, currentTrack, isPlaying, togglePlayback } = useMediaPlayer();
  const favorites = useJson<FavoriteRow[]>('/api/fan-favorites', (payload) =>
    ((payload as { favorites?: FavoriteRow[] }).favorites ?? []));
  const likes = useJson<LikeRow[]>('/api/likes', (payload) =>
    ((payload as { likes?: LikeRow[] }).likes ?? []));
  const stations = useJson<StationRow[]>('/api/stations', (payload) =>
    ((payload as { stations?: StationRow[] }).stations ?? []));
  const owned = useJson<PlaylistRow[]>('/api/fan-playlists', (payload) => {
    const lists = (payload as { playlists?: Array<Record<string, unknown>> }).playlists ?? [];
    return lists.map((list) => ({
      id: String(list.id ?? ''),
      name: String(list.name ?? 'Playlist'),
      count: Array.isArray(list.items) ? list.items.length : Number(list.itemCount ?? 0),
      items: Array.isArray(list.items) ? (list.items as PlayableRow[]) : [],
    }));
  });

  /* Rename and delete edit this list in place. Held separately from the fetch so
     a change shows immediately without refetching four endpoints, and seeded
     from the fetch rather than duplicating it. */
  const [lists, setLists] = useState<PlaylistRow[] | null>(null);
  useEffect(() => { if (owned.data) setLists(owned.data); }, [owned.data]);

  const tracks = favorites.data ?? [];
  /* `toQueue` addresses a row by hexId||id and favorites store the track's id as
     `mediaId` — without this mapping every liked row is silently dropped as
     unplayable and the whole section goes mute. */
  const playableTracks = tracks.map((row) => ({
    id: row.mediaId,
    title: row.title,
    artistName: row.artistName,
    artistSlug: row.artistProfileSlug,
    url: row.url,
    artworkUrl: row.artworkUrl,
  }));
  /* The joystick starts the liked tracks — the top section, and the one a member
     is most likely to mean by "play" here. Falls back to the first playlist when
     nothing is liked yet, which is what this tab registered before. */
  useRegisterQueue(playableTracks.length > 0 ? playableTracks : ((lists ?? [])[0]?.items ?? []));

  const playFrom = (index: number) => {
    const queue = toQueue(playableTracks);
    /* The queue drops unplayable rows, so the tapped row's position in the QUEUE
       has to be found by identity, not assumed from the list index. */
    const target = queue.findIndex((entry) => entry.mediaId === tracks[index].mediaId);
    if (target < 0) return;
    if (currentTrack?.id === queue[target].id) { togglePlayback(); return; }
    playTrack(queue[target], queue);
  };

  /* A station resolves on demand: there is no station-to-track join table, so
     its tracks only exist as the answer to a request. Nothing is registered for
     the joystick from here — tapping the row IS the request. */
  const playStation = async (slug: string) => {
    try {
      const response = await fetch(`/api/stations/${slug}/tracks?limit=40`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as { tracks?: StationTrackRow[] };
      const queue = toQueue(payload.tracks ?? []);
      if (queue.length > 0) playTrack(queue[0], queue);
    } catch { /* a station that cannot be read simply does not start */ }
  };

  if (favorites.status === 'loading' && likes.status === 'loading' && owned.status === 'loading') {
    return <Loading />;
  }

  const likedArtists = (likes.data ?? []).filter((row) => row.targetType === 'ARTIST' && row.name);
  const likedVenues = (likes.data ?? []).filter((row) => row.targetType === 'VENUE' && row.name);
  const ownLists = lists ?? [];
  const stationRows = stations.data ?? [];
  /* A FAILED READ IS NOT AN EMPTY LIBRARY.

     Every section here reads `?? []`, so a 500 from any of the four endpoints
     rendered pixel-for-pixel as a member who has saved nothing. That is the
     residual `measure:layout` kept reporting as a whole shelf present in one
     capture of a build and absent in the next (DESIGN_SYNC row 403) — and to a
     member it reads as iHYPE having lost their playlists, which is the one
     thing a library must never say by accident.
 
     Same rule `admin-workbench.ts`, `analytics-engine.ts` and the profile stat
     board already follow: null is never zero, and a read that failed says so
     rather than rendering a claim. It is stated once here rather than four
     times because the member's question is "is this all of it", not "which
     endpoint answered". */
  const unreadable = [favorites, likes, stations, owned].some((section) => section.status === 'error');
  const nothing = tracks.length === 0 && ownLists.length === 0
    && likedArtists.length === 0 && likedVenues.length === 0 && stationRows.length === 0;

  /* Empty and unreadable look identical from here, so the unreadable branch is
     tested FIRST: an empty plate is a claim about what the member saved, and
     that claim must never be made on top of a read that did not land. */
  if (nothing && unreadable) {
    return (
      <div className="mmm-music-list">
        <Empty>
          {t('mmmMusic.libraryUnreadable', 'Your library could not be read just now. Nothing has been lost — try again in a moment.')}
        </Empty>
      </div>
    );
  }

  if (nothing) {
    /* The crate rides along under the empty plate rather than behind it. A
       member who has saved nothing yet is exactly the one with no reason to
       come back — and the crate is the one thing on this tab that has content
       before they do. It renders nothing of its own when the crate is empty,
       so this cannot become an empty state followed by a second empty state. */
    return (
      <div className="mmm-music-list">
        <Empty>
          {t('mmmMusic.nothingSaved', 'Nothing saved yet. The heart on the player saves a track here; the hearts on artist and venue pages save them here too — everything stays until you unlike it.')}
        </Empty>
        <MmmFreeUseCrate playlists={[]} />
      </div>
    );
  }

  return (
    <div className="mmm-music-list">
      {/* Above the list, not below it: a member scanning for a playlist that is
          missing needs to know the list may be short BEFORE they conclude it is
          gone. */}
      {unreadable && (
        <Empty>
          {t('mmmMusic.libraryPartlyUnreadable', 'Part of your library could not be read just now, so something may be missing below. Nothing has been lost — try again in a moment.')}
        </Empty>
      )}
      {tracks.length > 0 && (
        <>
          <p className="mmm-eyebrow" style={{ padding: '2px 2px 8px' }}>{t('mmmMusic.likedTracks', 'Liked tracks')} · {tracks.length}</p>
          {tracks.map((row, index) => (
            <TrackRow
              active={currentTrack?.mediaId === row.mediaId || currentTrack?.id === row.mediaId}
              key={row.mediaId}
              onPlay={() => playFrom(index)}
              playing={isPlaying}
              row={row}
            />
          ))}
        </>
      )}

      {ownLists.length > 0 && (
        <>
          <p className="mmm-section-label" style={{ padding: '14px 2px 8px' }}>{t('mmmMusic.yourPlaylists', 'Your playlists')} · {ownLists.length}</p>
          {ownLists.map((list) => (
            <OwnPlaylistRow
              key={list.id}
              list={list}
              onDeleted={() => setLists((current) => (current ?? []).filter((entry) => entry.id !== list.id))}
              onRenamed={(name) => setLists((current) => (current ?? []).map((entry) => (entry.id === list.id ? { ...entry, name } : entry)))}
            />
          ))}
        </>
      )}

      {/* The free-use crate. Placed after the member's OWN lists because the
          select on each row targets one of them — the thing you add to should
          be on screen before the thing you add. */}
      <MmmFreeUseCrate playlists={ownLists.map((list) => ({ id: list.id, name: list.name }))} />

      {/* The computed stations, as a shelf. A station is a collection and this
          is not the surface that browses them — the RADIO tab is, and it stays
          a vertical list there, where every station's subtitle and count has
          room and where the whole set is the content. Here it is one of five
          things in a library, so it gets one row.

          `subtitle` survives as the tile's second line. The track COUNT does
          not fit a 104px tile and is dropped rather than truncated — the Radio
          tab still shows it, and a null there has always meant "could not be
          read", never zero. */}
      {/* `MmmShelf` renders nothing on zero tiles, which is right for a shelf
          with no collections and wrong for one that could not be read — the
          shelf would simply not be there, with no way to tell the two apart.
          The stations are the one section here the member did not build, so
          "you have none" is never the honest reading of their absence. */}
      {stations.status === 'error' ? (
        <Empty>{t('mmmMusic.stationsUnreadable', 'The automatic stations could not be read just now.')}</Empty>
      ) : (
      <MmmShelf
        count={stationRows.length}
        heading={t('mmmMusic.automaticallyAssembled', 'Automatically assembled')}
        seeAll="/app/music/radio"
        seeAllLabel={t('mmmMusic.radio', 'Radio')}
        tiles={stationRows.map((station) => ({
          id: station.slug,
          title: station.title,
          sub: station.subtitle,
          label: `${t('mmmMusic.play', 'Play')} ${station.title}`,
          onSelect: () => void playStation(station.slug),
        }))}
      />
      )}

      <LikedProfileRows
        heading={t('mmmMusic.likedArtists', 'Liked artists')}
        hrefFor={(row) => (row.slug ? `/app/artists/${row.slug}` : '/app/music/discover')}
        rows={likedArtists}
      />
      <LikedProfileRows
        heading={t('mmmMusic.likedVenues', 'Liked venues')}
        hrefFor={(row) => (row.slug ? `/app/venues/${row.slug}` : '/app/map?layer=venues')}
        rows={likedVenues}
      />
    </div>
  );
}
