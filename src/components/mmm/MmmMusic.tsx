'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MMM_MUSIC_TABS } from '@/lib/mmm-nav';
import type { StationSummary } from '@/app/api/stations/route';

export type MusicTabId = 'discover' | 'radio' | 'charts' | 'recommended' | 'playlists';

type SeedCard = { id: string; hexId: string; title: string; artistName: string; artistSlug: string; meta: string };
type ChartRow = { id: string; title: string; artistName: string; artistSlug: string; hypeCount: number };
type PlaylistRow = { id: string; name: string; count: number };
type StationTrackRow = { id: string; hexId: string; title: string; artistName: string; artistSlug: string };

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
export function MmmMusic({ tab }: { tab: MusicTabId }) {
  return (
    <>
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
      {tab === 'discover' && <DiscoverTab />}
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

function DiscoverTab() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const { status, data } = useJson<SeedCard[]>('/api/discover/seeds', (payload) => {
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

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <Empty>Discovery is unavailable right now. Radio and Charts still work.</Empty>;
  const seeds = data ?? [];
  const seed = seeds[index];
  if (!seed) {
    return (
      <Empty>
        {seeds.length === 0
          ? 'No seeds waiting — that usually means no new tracks near you yet. Try Radio, or a genre station.'
          : 'That is every seed for now. Come back tomorrow, or open Radio.'}
      </Empty>
    );
  }

  return (
    <>
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
          <button className="mmm-btn-ghost" onClick={() => router.push(`/tracks/${seed.hexId}`)} type="button">Open</button>
        </div>
      </div>
      <p className="mmm-eyebrow" style={{ textAlign: 'center', letterSpacing: '0.1em' }}>
        {seeds.length - index - 1} more waiting
      </p>
    </>
  );
}

function RadioTab() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('genre');
  const { status, data } = useJson<StationSummary[]>(
    '/api/stations',
    (payload) => (payload as { stations?: StationSummary[] }).stations ?? [],
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
      {stations.length === 0 && <Empty>No {active.label.toLowerCase()} station is active yet.</Empty>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {stations.map((station) => (
        <button
          className="mmm-row mmm-card mmm-station"
          data-playing="false"
          key={station.slug}
          onClick={() => router.push(`/radio?station=${station.slug}`)}
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
        <Link className="mmm-row" href={`/tracks/${track.hexId}`} key={track.id} style={{ display: 'flex' }}>
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
          <Link className="mmm-row" href={`/artists/${row.artistSlug}`} style={{ display: 'flex' }}>
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
        <Link className="mmm-row" href={`/playlist/${list.id}`} key={list.id} style={{ display: 'flex' }}>
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
