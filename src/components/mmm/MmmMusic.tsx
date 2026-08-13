'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { useRouter } from 'next/navigation';
import { MMM_MUSIC_TABS } from '@/lib/mmm-nav';
import { MmmSearch } from './MmmSearch';
import type { StationSummary } from '@/app/api/stations/route';

export type MusicTabId = 'discover' | 'radio' | 'charts' | 'recommended' | 'playlists';

type SeedCard = { id: string; hexId: string; title: string; artistName: string; artistSlug: string; meta: string };
type ChartRow = { id: string; title: string; artistName: string; artistSlug: string; hypeCount: number };
type PlaylistRow = { id: string; name: string; count: number };
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
export function MmmMusic({ tab, genre, city, q }: { tab: MusicTabId; genre?: string; city?: string; q?: string }) {
  return (
    <>
      {/* Tabs on one row, search on the next — the 2026-08-10 template moved
          them apart. Sharing a row read as tighter and was not: five tabs plus
          a field wrap to two rows of chips on a phone, which costs more height
          than the field saved AND shifts the first card by a different amount
          on each tab, so the module reads as a different page per tab.

          The wrapper is now a column; `.mmm-tabs` holds one line at every
          width. The strip keeps its `nav` semantics and search is still not a
          tab. There is deliberately no eyebrow, headline or dek above this:
          the tab already names the surface, and a standing description of a
          screen you visit daily is furniture by the third visit. */}
      <div className="mmm-music-controls">
        <nav aria-label="Music" className="mmm-tabs">
          {MMM_MUSIC_TABS.map((item) => (
            <Link
              aria-current={item.id === tab ? 'page' : undefined}
              className="mmm-tab"
              href={item.href}
              key={item.id}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <MmmSearch initialQuery={q ?? ''} />
      </div>
      {tab === 'discover' && <DiscoverTab city={city} genre={genre} />}
      {tab === 'radio' && <RadioTab />}
      {tab === 'charts' && <ChartsTab />}
      {tab === 'recommended' && <RecommendedTab />}
      {tab === 'playlists' && <PlaylistsTab />}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.84rem', color: 'var(--ink-3)', lineHeight: 1.6, padding: '10px 2px' }}>{children}</p>;
}

function Loading() {
  return <p className="mmm-eyebrow" role="status" style={{ padding: '10px 2px' }}>Loading…</p>;
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
function DiscoverTab({ genre, city }: { genre?: string; city?: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
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
    return seeds.map((seed) => ({
      id: String(seed.id ?? ''),
      hexId: String(seed.hexId ?? ''),
      title: String(seed.title ?? 'Untitled'),
      artistName: String((seed.artistName as string) ?? (seed.profile as { name?: string })?.name ?? 'Unknown artist'),
      artistSlug: String((seed.artistSlug as string) ?? (seed.profile as { slug?: string })?.slug ?? ''),
      meta: [
        (seed.genre as string) ?? ((seed.profile as { genres?: string[] })?.genres ?? [])[0],
        (seed.city as string) ?? (seed.profile as { city?: string })?.city,
      ].filter(Boolean).join(' · '),
    }));
  });

  const act = useCallback(async (seed: SeedCard, action: 'hype' | 'skip') => {
    setBusy(true);
    try {
      await fetch(`/api/discover/seeds/${seed.id}/${action}`, { method: 'POST' });
    } catch {
      // A dropped gesture must not strand the deck — advance regardless.
    } finally {
      setBusy(false);
      setIndex((value) => value + 1);
    }
  }, []);

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

  return (
    <>
      {filterChip}
      <div className="mmm-card mmm-card-accent" style={{ padding: 20, marginBottom: 14, minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div className="mmm-eyebrow mmm-eyebrow-accent" style={{ marginBottom: 7, fontSize: '0.58rem', letterSpacing: '0.14em' }}>Seed</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.7rem', letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1.05 }}>
          {seed.title}
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--ink-2)', marginTop: 3 }}>
          {[seed.artistName, seed.meta].filter(Boolean).join(' · ')}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="mmm-btn-primary" disabled={busy} onClick={() => void act(seed, 'hype')} style={{ flex: 1 }} type="button">Hype</button>
          <button className="mmm-btn-ghost" disabled={busy} onClick={() => void act(seed, 'skip')} type="button">Skip</button>
          <button className="mmm-btn-ghost" onClick={() => router.push(`/app/tracks/${seed.hexId}`)} type="button">Open</button>
        </div>
      </div>
      <p className="mmm-eyebrow" style={{ textAlign: 'center', letterSpacing: '0.1em' }}>
        {seeds.length - index - 1} more waiting
      </p>
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
        const queue = (payload.tracks ?? [])
          // A row with no stored audio cannot be played; keeping it in the
          // queue would stall the player on a dead entry.
          .filter((row) => Boolean(row.mediaUrl))
          .map((row) => ({
            id: row.hexId,
            mediaId: row.hexId,
            title: row.title,
            artistName: row.artistName,
            url: row.mediaUrl as string,
            artistProfileSlug: row.artistSlug ?? null,
            artworkUrl: row.artworkUrl ?? null,
          }));
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
          <span aria-hidden="true" className="mmm-station-art">▶</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="mmm-row-title" style={{ display: 'block' }}>{station.title}</span>
            <span className="mmm-row-sub" style={{ display: 'block' }}>{station.subtitle}</span>
          </span>
          {/* A null count means the query failed. Rendering "0 tracks" beside a
              station that may be full is worse than rendering nothing. */}
          {station.trackCount !== null && (
            <span className="mmm-row-meta" style={{ color: 'var(--ink-3)', fontSize: '0.58rem', letterSpacing: '0.06em' }}>
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

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Recommendations are unavailable right now.</Empty>;
  const tracks = data ?? [];
  if (!tracks.length) {
    return <Empty>Nothing recommended yet — this fills in from the accounts you follow. Follow an artist and their uploads land here.</Empty>;
  }

  return (
    <div>
      {tracks.map((track) => (
        <Link className="mmm-row" href={`/app/tracks/${track.hexId}`} key={track.id} style={{ display: 'flex' }}>
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
    }));
  });

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Charts are unavailable right now.</Empty>;
  const rows = data ?? [];
  if (!rows.length) {
    return <Empty>The chart needs a week of hypes before it can rank anything. Hype a few tracks in Discover and it will fill in.</Empty>;
  }

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {rows.map((row, index) => (
        <li key={row.id}>
          <Link className="mmm-row" href={`/app/artists/${row.artistSlug}`} style={{ display: 'flex' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-3)', width: 22 }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{row.title}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{row.artistName}</span>
            </span>
            <span className="mmm-row-meta">{row.hypeCount.toLocaleString()}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function PlaylistsTab() {
  const { status, data } = useJson<PlaylistRow[]>('/api/fan-playlists', (payload) => {
    const lists = (payload as { playlists?: Array<Record<string, unknown>> }).playlists ?? [];
    return lists.map((list) => ({
      id: String(list.id ?? ''),
      name: String(list.name ?? 'Playlist'),
      count: Array.isArray(list.items) ? list.items.length : Number(list.itemCount ?? 0),
    }));
  });

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Playlists are unavailable right now.</Empty>;
  const lists = data ?? [];
  if (!lists.length) {
    return <Empty>No playlists yet. A right-swipe in Discover files a track into your Discover playlist and it will appear here.</Empty>;
  }

  // Each row links to its own playlist. /playlists never existed, so every
  // row used to point at the same dead URL. The real route is
  // /playlist/[slug], where the "slug" is the FanPlaylist id — page.tsx looks
  // it up with findUnique({ id }), and that id is exactly what
  // /api/fan-playlists returns.
  return (
    <div>
      {lists.map((list) => (
        <Link className="mmm-row" href={`/app/playlists/${list.id}`} key={list.id} style={{ display: 'flex' }}>
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
