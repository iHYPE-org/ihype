'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useI18n } from '@/components/I18nProvider';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import { useAppShellActive } from '@/components/shell/AppShellContext';

const PALETTE = ['#ff5029', 'var(--role-fan)', 'var(--role-venue)', 'var(--accent-2)', 'var(--role-promoter)', '#7fb3ff'];

/**
 * The tab ids the app shell's persistent context strip already carries for
 * LISTEN (Discover · Radio · Charts · Playlists). Inside the shell this
 * component drops them from its own strip so the two rows are not stacked one
 * on top of the other — but it keeps every tab the strip does NOT carry
 * ('search'), because hiding the whole strip would strand that destination
 * with nothing linking to it.
 */
const SHELL_TABS: readonly string[] = ['seeds', 'radio', 'charts', 'playlists'];

const TABS = [
  { id: 'search', label: 'Search' },
  { id: 'seeds', label: 'Seeds' },
  { id: 'radio', label: 'Radio' },
  { id: 'charts', label: 'Charts' },
  { id: 'playlists', label: 'Playlists' },
] as const;
type ListenTab = (typeof TABS)[number]['id'];

type Seed = {
  id: string;
  title: string;
  artistName: string;
  genres: string[];
  hypeCount: number;
  reason: string;
};

type RadioShow = {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  headlinerProfile?: { name: string } | null;
};

type DiscoveryShow = {
  id: string;
  slug: string;
  title: string;
  startsAt: string | null;
  posterImage?: string | null;
  headlinerProfile?: { name: string; avatarImage?: string | null } | null;
  venueProfile?: { name: string; city?: string | null; stateRegion?: string | null } | null;
};

type ChartTrack = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  city: string;
  genres: string[];
  hypeCount: number;
  color: string;
  mediaUrl: string;
  durationSec: number;
  artworkUrl: string | null;
};

type SearchResult = {
  type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
  hypeCount?: number;
};

type PlaylistItem = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  url: string;
  artistProfileSlug: string | null;
  position: number;
};

type Playlist = { id: string; name: string; items: PlaylistItem[] };

type FavoriteMedia = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  artistProfileSlug: string | null;
};

type SavedSeed = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  artistProfileSlug: string;
  artistProfileType: string;
};

const PLACEHOLDER_SHOWS = [
  '/brand/alpha-show-1.png',
  '/brand/alpha-show-2.png',
  '/brand/alpha-show-3.png',
  '/brand/alpha-show-4.png',
];

function DiscoveryHome({
  charts,
  shows,
  onOpen,
  onPlay,
}: {
  charts: ChartTrack[] | null;
  shows: DiscoveryShow[] | null;
  onOpen: (tab: ListenTab) => void;
  onPlay: (track: ChartTrack, queue: ChartTrack[]) => void;
}) {
  const tracks = charts ?? [];
  const displayTracks: Array<ChartTrack | null> = tracks.length ? tracks.slice(0, 4) : [null, null, null, null];
  const featured = tracks[0];
  const localShows = (shows ?? []).filter((show) => show.startsAt && new Date(show.startsAt) >= new Date()).slice(0, 4);
  const displayShows: Array<DiscoveryShow | null> = localShows.length ? localShows : [null, null, null, null];
  const artistNames = [...new Set(tracks.map((track) => track.artistName))].slice(0, 5);

  return (
    <div className="discovery-home">
      <section className="discovery-section">
        <div className="discovery-heading"><div><h1>For you</h1><p>Fresh independent sounds, picked for you.</p></div><button onClick={() => onOpen('charts')} type="button">View all →</button></div>
        <div className="discovery-feature-grid">
          <article className="discovery-feature">
            <Image alt="" fill priority sizes="(max-width: 760px) 100vw, 55vw" src={featured?.artworkUrl ?? '/brand/alpha-featured.png'} />
            <div><span>NEW MUSIC</span><h2>{featured?.artistName ?? 'Your local scene'}</h2><strong>{featured?.title ?? 'Fresh independent music'}</strong><button disabled={!featured} onClick={() => featured && onPlay(featured, tracks)} type="button">▶ Play now</button></div>
          </article>
          <div className="discovery-track-list">
            {displayTracks.map((track, index) => (
              <div className="discovery-track-row" key={track?.id ?? index}>
                <Image alt="" height={54} src={track?.artworkUrl ?? PLACEHOLDER_SHOWS[index]} width={64} />
                <div><strong>{track?.title ?? 'New local track'}</strong><span>{track?.artistName ?? 'Independent artist'}</span></div>
                {track ? <><button aria-label={`Play ${track.title}`} onClick={() => onPlay(track, tracks)} type="button">▶</button><span>{Math.floor(track.durationSec / 60)}:{String(track.durationSec % 60).padStart(2, '0')}</span></> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="discovery-section">
        <div className="discovery-heading"><div><h2>Live near you</h2><p>Upcoming shows from independent artists.</p></div><Link href="/shows">View all →</Link></div>
        <div className="discovery-show-grid">
          {displayShows.map((realShow, index) => {
            const date = realShow?.startsAt ? new Date(realShow.startsAt) : null;
            return (
              <article className="discovery-show-card" key={realShow?.id ?? index}>
                <div className="discovery-show-art">
                  <Image alt="" fill sizes="(max-width: 760px) 46vw, 22vw" src={realShow?.posterImage ?? PLACEHOLDER_SHOWS[index]} />
                  <span>{date ? date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) : 'COMING SOON'}</span>
                </div>
                <strong>{realShow?.headlinerProfile?.name ?? realShow?.title ?? 'Local artist'}</strong>
                <small>{[realShow?.venueProfile?.name, realShow?.venueProfile?.city].filter(Boolean).join(' · ') || 'Your local scene'}</small>
                <Link href={realShow ? `/shows/${realShow.slug}` : '/shows'}>Tickets</Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="discovery-section discovery-artists">
        <div className="discovery-heading"><div><h2>Because you listen local</h2><p>More independent artists in your orbit.</p></div><button onClick={() => onOpen('seeds')} type="button">More like this →</button></div>
        <div>{(artistNames.length ? artistNames : ['New artists', 'Local voices', 'Fresh sounds', 'Your scene', 'Next up']).map((name, index) => <button key={name} onClick={() => onOpen('seeds')} type="button"><Image alt="" height={112} src={index < 4 ? `/brand/alpha-artist-${Math.max(2, index + 1)}.png` : '/brand/alpha-show-2.png'} width={112} /><span>{name}</span></button>)}</div>
      </section>

      <section className="discovery-section discovery-rising">
        <div className="discovery-heading"><div><h2>HYPE rising</h2><p>The strongest real signal moving through nearby scenes.</p></div><button onClick={() => onOpen('charts')} type="button">View charts →</button></div>
        <div className="discovery-rising-grid">
          {(tracks.length ? tracks.slice(0, 3) : [null, null, null]).map((track, index) => (
            <button
              className="discovery-rising-card"
              disabled={!track}
              key={track?.id ?? index}
              onClick={() => track && onPlay(track, tracks)}
              type="button"
            >
              <Image alt="" fill sizes="(max-width: 760px) 80vw, 30vw" src={track?.artworkUrl ?? PLACEHOLDER_SHOWS[index]} />
              <span className="discovery-rising-rank">0{index + 1}</span>
              <span className="discovery-rising-copy">
                <strong>{track?.title ?? 'Your scene is warming up'}</strong>
                <small>{track?.artistName ?? 'Fresh local HYPE will appear here'}</small>
              </span>
              <span className="discovery-rising-hype">{track ? `${track.hypeCount.toLocaleString()} HYPE` : 'LOCAL SIGNAL'}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function profileHref(type: string, slug: string) {
  return type === 'VENUE' ? `/venues/${slug}` : type === 'DJ' ? `/promoters/${slug}` : `/artists/${slug}`;
}

const b: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, padding: '9px 16px', minHeight: 44,
  borderRadius: 9, cursor: 'pointer', border: 'none', transition: 'all 150ms',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none',
};
const bSolid: React.CSSProperties = { ...b, background: 'var(--accent)', color: 'var(--ink-on-accent)' };
const bGhost: React.CSSProperties = { ...b, background: 'transparent', color: 'var(--ink-a60)', boxShadow: 'inset 0 0 0 1px var(--hair-100)' };

const panel: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 16, background: 'var(--hair-30)', overflow: 'hidden' };
const panelHead: React.CSSProperties = { padding: '16px 20px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-a50)' };
const chartRow: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--hair-50)' };
const emptyStyle: React.CSSProperties = { textAlign: 'center', padding: '60px 24px', color: 'var(--ink-a50)' };
const rowTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const rowSubtitle: React.CSSProperties = { fontSize: 12, color: 'var(--ink-a55)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={panel}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={chartRow}>
          <div className="ihype-skeleton" style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
            <div className="ihype-skeleton" style={{ width: `${55 - i * 6}%`, height: 15, borderRadius: 5 }} />
            <div className="ihype-skeleton" style={{ width: `${35 - i * 4}%`, height: 11, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} style={{ border: '1px solid var(--hair-70)', borderRadius: 16, padding: 20, background: 'var(--hair-30)', display: 'grid', gap: 10 }}>
          <div className="ihype-skeleton" style={{ width: 90, height: 11, borderRadius: 4 }} />
          <div className="ihype-skeleton" style={{ width: '60%', height: 19, borderRadius: 5 }} />
          <div className="ihype-skeleton" style={{ width: '35%', height: 13, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

function timeLabel(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function SeedDeck({ seeds, onAct }: { seeds: Seed[]; onAct: (seed: Seed, action: 'save' | 'skip' | 'hype') => void }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [flash, setFlash] = useState<'add' | 'skip' | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const card = seeds[idx];
  const next = seeds[idx + 1];

  if (!card) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 24px' }}>
        <p style={{ marginTop: 14, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--ink-a60)' }}>{t('listenHome.seedDeckCaughtUp', "You're all caught up.")}</p>
        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-a50)' }}>{t('listenHome.seedDeckCaughtUpBody', 'New seeds drop as artists upload. Check back soon.')}</p>
        <button style={{ ...bGhost, marginTop: 18 }} onClick={() => setIdx(0)} type="button">{t('listenHome.seedDeckStartOver', 'Start over')}</button>
      </div>
    );
  }

  const color = PALETTE[idx % PALETTE.length];
  const g2 = PALETTE[(idx + 2) % PALETTE.length];
  const nextColor = next ? PALETTE[(idx + 1) % PALETTE.length] : color;
  const nextG2 = next ? PALETTE[(idx + 3) % PALETTE.length] : g2;

  function decide(x: number) {
    if (x > 95) return 'add';
    if (x < -95) return 'skip';
    return null;
  }
  function onDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    setDrag({ x, y, active: true });
    setFlash(x > 35 ? 'add' : x < -35 ? 'skip' : null);
  }
  function onUp() {
    if (!start.current) return;
    const d = decide(drag.x);
    start.current = null;
    if (d) commit(d);
    else { setDrag({ x: 0, y: 0, active: false }); setFlash(null); }
  }
  function commit(d: 'add' | 'skip') {
    const off = d === 'add' ? { x: 560, y: 0 } : { x: -560, y: 0 };
    setDrag({ ...off, active: false });
    onAct(card, d === 'add' ? 'save' : 'skip');
    setTimeout(() => {
      setDrag({ x: 0, y: 0, active: false });
      setFlash(null);
      setIdx((i) => i + 1);
    }, 230);
  }

  const rot = drag.x / 12;
  const lift = Math.min(1, Math.abs(drag.x) / 260);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 440, aspectRatio: '1 / 1', margin: '4px auto 0', touchAction: 'none' }}>
        {next && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden', border: '1px solid var(--hair-120)',
            background: `linear-gradient(155deg, ${nextColor}, ${nextG2})`,
            transform: `scale(${Math.min(1, 0.94 + Math.abs(drag.x) / 2600)}) translateY(${Math.max(0, 10 - Math.abs(drag.x) / 26)}px)`,
            opacity: Math.min(0.78, 0.55 + Math.abs(drag.x) / 900),
            transition: drag.active ? 'none' : 'transform .23s cubic-bezier(.4,0,.2,1), opacity .23s ease',
          }} />
        )}

        <div
          onPointerCancel={onUp}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          style={{
            position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden', border: '1px solid var(--hair-120)',
            boxShadow: `0 ${24 + lift * 30}px ${70 + lift * 60}px rgba(0,0,0,${0.6 + lift * 0.15})`,
            background: `linear-gradient(155deg, ${color}, ${g2})`,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', userSelect: 'none', cursor: 'grab',
            transform: `translateX(${drag.x}px) translateY(${drag.y * 0.22 + (drag.active ? -lift * 10 : 0)}px) rotate(${rot}deg) scale(${1 + lift * 0.035})`,
            transition: drag.active ? 'none' : 'transform .28s cubic-bezier(.34,1.2,.4,1), box-shadow .28s ease',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.06) 48%, rgba(0,0,0,.2) 100%)' }} />

          <div style={{
            position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.92)',
            background: 'rgba(0,0,0,.28)', border: '1px solid var(--hair-220)', padding: '5px 11px', borderRadius: 9999,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} /> {t('listenHome.seedDeckNewSeedBadge', 'New seed')}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onAct(card, 'hype'); }}
            style={{
              position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: '#fff', cursor: 'pointer',
              background: 'rgba(0,0,0,.3)', border: '1px solid var(--hair-200)', padding: '5px 11px', borderRadius: 9999,
            }}
            type="button"
          >
            🔥 {card.hypeCount || '—'}
          </button>

          {flash === 'add' && (
            <div style={{ position: 'absolute', top: '50%', right: 24, zIndex: 5, transform: `translateY(-50%) scale(${Math.min(1.15, 0.85 + Math.abs(drag.x) / 320)})`, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-on-accent)', padding: '10px 22px', borderRadius: 14, border: '3px solid #22e5d4', background: 'rgba(var(--role-venue-rgb),.34)', boxShadow: '0 0 30px rgba(var(--role-venue-rgb),.5)' }}>{t('listenHome.seedDeckFlashSeed', 'Seed')}</div>
          )}
          {flash === 'skip' && (
            <div style={{ position: 'absolute', top: '50%', left: 24, zIndex: 5, transform: `translateY(-50%) scale(${Math.min(1.15, 0.85 + Math.abs(drag.x) / 320)})`, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', padding: '10px 22px', borderRadius: 14, border: '3px solid #fff', background: 'rgba(0,0,0,.42)' }}>{t('listenHome.seedDeckFlashSkip', 'Skip')}</div>
          )}

          <div style={{ position: 'relative', zIndex: 3, padding: 22 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 11 }}>
              {card.genres.slice(0, 3).map((t) => (
                <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff', background: 'var(--line-2)', border: '1px solid var(--hair-280)', borderRadius: 9999, padding: '3px 10px' }}>{t}</span>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, letterSpacing: '-.035em', color: '#fff', lineHeight: 0.98, textShadow: '0 2px 18px rgba(0,0,0,.4)' }}>{card.title}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(255,255,255,.92)', marginTop: 5 }}>{card.artistName} · {card.reason}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 24 }}>
        <button onClick={() => commit('skip')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }} type="button">
          <span style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--hair-120)', background: 'var(--hair-40)' }}>✕</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>{t('listenHome.seedsSkipLabel', 'Skip')}</span>
        </button>
        <button onClick={() => commit('add')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }} type="button">
          <span style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(var(--role-venue-rgb),.4)', background: 'rgba(var(--role-venue-rgb),.14)' }}>+</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>{t('listenHome.seedsSaveLabel', 'Save to library')}</span>
        </button>
      </div>
      <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-a50)' }}>{idx + 1} / {seeds.length}</div>
    </div>
  );
}

export function ListenHome({
  initialTab,
  isShellForeground = true,
  resetToken,
}: {
  initialTab?: string;
  isShellForeground?: boolean;
  resetToken?: number;
} = {}) {
  const { t } = useI18n();
  const { playTrack } = useMediaPlayer();
  const validInitialTab = TABS.some((tabDef) => tabDef.id === initialTab) ? (initialTab as ListenTab) : null;
  const [tab, setTab] = useState<ListenTab>(validInitialTab ?? 'seeds');
  const [gridMode, setGridMode] = useState(!validInitialTab);
  // The app shell's context strip navigates between these tabs with real
  // links (/listen?tab=charts). Same route, different query = a soft nav, so
  // this component never remounts and the useState initialiser above never
  // re-runs — without this the pill would light up and the content would sit
  // still. Identical fix to the one InfoTabs needed for `/info?tab=`.
  useEffect(() => {
    if (!validInitialTab) return;
    setTab(validInitialTab);
    setGridMode(false);
  }, [validInitialTab]);
  const shellDrivesTabs = useAppShellActive();
  const visibleTabs = shellDrivesTabs ? TABS.filter((d) => !SHELL_TABS.includes(d.id)) : TABS;
  const prevResetToken = useRef(resetToken);
  useEffect(() => {
    if (resetToken !== undefined && resetToken !== prevResetToken.current) {
      prevResetToken.current = resetToken;
      setGridMode(true);
    }
  }, [resetToken]);
  const [genre, setGenre] = useState('All');
  const [seeds, setSeeds] = useState<Seed[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [radio, setRadio] = useState<RadioShow[] | null>(null);
  const [discoveryShows, setDiscoveryShows] = useState<DiscoveryShow[] | null>(null);
  const [charts, setCharts] = useState<{ national: ChartTrack[]; local: ChartTrack[]; forYou: ChartTrack[] } | null>(null);
  const [chartScope, setChartScope] = useState<'local' | 'forYou' | 'national'>('forYou');
  const [chartGenre, setChartGenre] = useState('All');
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [favorites, setFavorites] = useState<FavoriteMedia[]>([]);
  const [savedSeeds, setSavedSeeds] = useState<SavedSeed[]>([]);
  const [openPl, setOpenPl] = useState<string | null>(null);
  const [newPlName, setNewPlName] = useState('');
  const [dragState, setDragState] = useState<{ index: number; overIndex: number } | null>(null);
  const rowRefsRef = useRef<(HTMLDivElement | null)[]>([]);
  const contentTopRef = useRef<HTMLDivElement>(null);

  // Switching tabs (including the first grid→tab transition) should always
  // land at the top of the new tab's content — the scroll container (either
  // window on desktop, or the shell's own .mas-slot on mobile) otherwise
  // keeps whatever scrollTop the previous tab left behind.
  // Inside the app shell the shell owns scroll position across navigation
  // (ShellScrollManager) — the context strip's pills ARE the tab switch, so a
  // second owner here fights it and wins by running later, leaving the region
  // parked 141px down. Verified by e2e: expected 0, got 141. Outside the shell
  // (phone swipe shell, marketing) this is still the only thing that resets it.
  useEffect(() => {
    if (shellDrivesTabs) return;
    contentTopRef.current?.scrollIntoView({ block: 'start' });
  }, [tab, shellDrivesTabs]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const refreshAll = useCallback(() => {
    return Promise.all([
      fetch('/api/discover/seeds').then((r) => r.json()).then((d) => setSeeds(d.seeds ?? [])).catch(() => setSeeds([])),
      fetch('/api/shows?radioShows=1').then((r) => (r.ok ? r.json() : [])).then((d) => setRadio(Array.isArray(d) ? d : [])).catch(() => setRadio([])),
      fetch('/api/shows').then((r) => (r.ok ? r.json() : [])).then((d) => setDiscoveryShows(Array.isArray(d) ? d : [])).catch(() => setDiscoveryShows([])),
      fetch('/api/charts').then((r) => r.json()).then((d) => setCharts(d)).catch(() => setCharts({ national: [], local: [], forYou: [] })),
      fetch('/api/fan-playlists').then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (d) { setPlaylists(d.playlists ?? []); setFavorites(d.favorites ?? []); setSavedSeeds(d.savedSeeds ?? []); }
      }).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ql = q.trim();
    if (!ql) { setSearchResults(null); return; }
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(ql)}&type=all`).then((r) => r.json()).then((d) => setSearchResults(d.results ?? [])).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  async function actOnSeed(seed: Seed, action: 'save' | 'skip' | 'hype') {
    if (action !== 'hype') {
      showToast(action === 'save' ? 'Saved to your library' : 'Skipped');
    } else {
      showToast('Hyped');
      setSeeds((ss) => (ss ? ss.map((s) => (s.id === seed.id ? { ...s, hypeCount: s.hypeCount + 1 } : s)) : ss));
    }
    try {
      await fetch(`/api/discover/seeds/${seed.id}/${action}`, { method: 'POST' });
      if (action === 'save') {
        fetch('/api/fan-playlists').then((r) => (r.ok ? r.json() : null)).then((d) => {
          if (d) setSavedSeeds(d.savedSeeds ?? []);
        }).catch(() => {});
      }
    } catch { /* best-effort */ }
  }

  async function createPlaylist() {
    const name = newPlName.trim();
    if (!name) return;
    const res = await fetch('/api/fan-playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? 'Could not create playlist.'); return; }
    setPlaylists((ps) => [...(ps ?? []), data]);
    setNewPlName('');
    showToast('Playlist created');
  }

  async function removeItem(playlistId: string, itemId: string) {
    const res = await fetch(`/api/fan-playlists/${playlistId}/items/${itemId}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Could not remove this track.'); return; }
    setPlaylists((ps) => (ps ?? []).map((p) => (p.id === playlistId ? { ...p, items: p.items.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, position: idx })) } : p)));
  }

  async function persistReorder(playlistId: string, items: PlaylistItem[]) {
    const res = await fetch(`/api/fan-playlists/${playlistId}/items`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: items.map((i) => i.id) }) });
    const data = await res.json();
    if (res.ok) {
      setPlaylists((ps) => (ps ?? []).map((p) => (p.id === playlistId ? { ...p, items: data.items ?? items } : p)));
    }
  }

  function onGripPointerDown(playlistId: string, idx: number, e: React.PointerEvent) {
    e.preventDefault();
    setDragState({ index: idx, overIndex: idx });
    const move = (ev: PointerEvent) => {
      const y = ev.clientY;
      let newOver = idx;
      rowRefsRef.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) newOver = i;
      });
      setDragState((ds) => (ds ? { ...ds, overIndex: newOver } : ds));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragState((ds) => {
        if (ds && ds.index !== ds.overIndex) {
          const playlist = (playlists ?? []).find((p) => p.id === playlistId);
          if (playlist) {
            const items = [...playlist.items];
            const [moved] = items.splice(ds.index, 1);
            items.splice(ds.overIndex, 0, moved);
            const normalized = items.map((it, i) => ({ ...it, position: i }));
            setPlaylists((ps) => (ps ?? []).map((p) => (p.id === playlistId ? { ...p, items: normalized } : p)));
            void persistReorder(playlistId, normalized);
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function shareLink(playlistId: string) {
    const link = `${window.location.origin}/playlist/${playlistId}`;
    navigator.clipboard?.writeText(link);
    showToast('Share link copied');
  }

  function playChartTrack(track: ChartTrack, queue: ChartTrack[]) {
    const toMediaTrack = (item: ChartTrack): MediaTrack => ({
      id: item.id,
      mediaId: item.id,
      title: item.title,
      artistName: item.artistName,
      artistProfileSlug: item.artistSlug,
      url: item.mediaUrl,
      artworkUrl: item.artworkUrl,
    });
    playTrack(toMediaTrack(track), queue.map(toMediaTrack));
  }

  const genres = useMemo(() => {
    const set = new Set<string>();
    (seeds ?? []).forEach((s) => s.genres.forEach((g) => set.add(g)));
    return ['All', ...Array.from(set)];
  }, [seeds]);

  const filteredSeeds = genre === 'All' ? seeds ?? [] : (seeds ?? []).filter((s) => s.genres.includes(genre));

  const chartRows = charts ? charts[chartScope] : [];
  const chartGenres = useMemo(() => {
    const set = new Set<string>();
    chartRows.forEach((c) => c.genres.forEach((g) => set.add(g)));
    return ['All', ...Array.from(set)];
  }, [chartRows]);
  const filteredChartRows = chartGenre === 'All' ? chartRows : chartRows.filter((c) => c.genres.includes(chartGenre));

  const liveShow = (radio ?? []).find((s) => s.status === 'LIVE');
  const upcomingShows = (radio ?? []).filter((s) => s.status === 'SCHEDULED').slice(0, 3);

  const searchArtists = (searchResults ?? []).filter((r) => r.type === 'artist' || r.type === 'venue' || r.type === 'promoter');
  const searchSongs = (searchResults ?? []).filter((r) => r.type === 'song');

  const openPlaylist = (playlists ?? []).find((p) => p.id === openPl) ?? null;

  return (
    <div className="listen-stage">
      <style>{`@keyframes ihype-blink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }`}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: 'var(--ink)', color: 'var(--bg)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, padding: '12px 22px', borderRadius: 9999, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}

      {gridMode && isShellForeground ? (
        <DiscoveryHome
          charts={charts?.forYou ?? charts?.local ?? null}
          onOpen={(nextTab) => { setGridMode(false); setTab(nextTab); }}
          onPlay={playChartTrack}
          shows={discoveryShows}
        />
      ) : null}

      <PullToRefresh onRefresh={refreshAll}>
      <div className={`mqg-content${gridMode ? ' is-hidden' : ''}`}>
      <div ref={contentTopRef} />
      <button className="mqg-back" onClick={() => setGridMode(true)} type="button">
        <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><polyline points="15 18 9 12 15 6" /></svg>
        {t('listenHome.backButton', 'Listen')}
      </button>

      <section className="listen-stage-hero">
        <div>
          <p className="listen-stage-kicker">{t('listenHome.heroKicker', 'Your scene · free forever')}</p>
          <h1>{t('listenHome.heroTitle', 'What do you want to hear?')}</h1>
          <p>{t('listenHome.heroBody', 'Start with a Seed, tune into local radio, or follow the HYPE moving through your scene.')}</p>
        </div>
        <Link className="listen-stage-dashboard" href="/me/dashboard">
          <span>{t('listenHome.heroDashboardLabel', 'Your HYPE')}</span>
          <strong>{t('listenHome.heroDashboardCta', 'Open dashboard')} →</strong>
        </Link>
      </section>

      <div className="mqg-tabstrip listen-stage-tabs">
        {visibleTabs.map((tabDef) => (
          <button
            key={tabDef.id}
            className={tab === tabDef.id ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab(tabDef.id)}
            type="button"
          >
            {t(`listenHome.tab.${tabDef.id}`, tabDef.label)}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      {tab === 'search' && (
        <div className="sub-panel">
          <input
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('listenHome.searchPlaceholder', 'Search artists, venues, shows…')}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--hair-30)', border: '1px solid var(--hair-80)', borderRadius: 12, padding: '14px 16px', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, marginBottom: 24 }}
            type="text"
            value={q}
          />
          {!q.trim() && <div style={emptyStyle}><p>{t('listenHome.searchHint', 'Search across tracks, artists, and genres.')}</p></div>}
          {q.trim() && searchResults === null && <ListSkeleton rows={5} />}
          {q.trim() && searchResults && searchArtists.length === 0 && searchSongs.length === 0 && (
            <div style={emptyStyle}><p>{t('listenHome.searchNoResults', 'No results for')} &ldquo;{q}&rdquo;.</p></div>
          )}
          {searchArtists.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginBottom: 12 }}>{t('listenHome.searchArtistsHeading', 'Artists')}</div>
              <div style={panel}>
                {searchArtists.map((r, i) => (
                  <Link key={r.id} href={r.type === 'venue' ? `/venues/${r.slug}` : r.type === 'promoter' ? `/promoters/${r.slug}` : `/artists/${r.slug}`} style={{ ...chartRow, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                    <div style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0, background: PALETTE[i % PALETTE.length] }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={rowTitle}>{r.name}</div>
                      <div style={rowSubtitle}>{r.subtitle}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{r.hypeCount?.toLocaleString() ?? ''}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {searchSongs.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginBottom: 12 }}>{t('listenHome.searchTracksHeading', 'Tracks')}</div>
              <div style={panel}>
                {searchSongs.map((r) => (
                  <div key={r.id} style={chartRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={rowTitle}>{r.name}</div>
                      <div style={rowSubtitle}>{r.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEEDS */}
      {tab === 'seeds' && (
        <div className="sub-panel">
          {genres.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {genres.map((g) => (
                <div
                  key={g}
                  onClick={() => setGenre(g)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 9999, cursor: 'pointer',
                    background: genre === g ? 'var(--ink)' : 'var(--hair-30)', border: '1px solid var(--hair-80)',
                    color: genre === g ? 'var(--bg)' : 'var(--ink-a50)',
                  }}
                >
                  {g}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--ink-a50)', margin: '0 0 18px', textAlign: 'center' }}>{t('listenHome.seedsSwipeHint', 'Swipe right to save · left to skip')}</p>
          {seeds === null ? (
            <div style={{ position: 'relative', width: '100%', maxWidth: 440, aspectRatio: '1 / 1', margin: '4px auto 0' }}>
              <div className="ihype-skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 28 }} />
            </div>
          ) : filteredSeeds.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Same frame the seed deck renders into — the module keeps its design even with nothing to show */}
              <div style={{
                position: 'relative', width: '100%', maxWidth: 440, aspectRatio: '1 / 1', margin: '4px auto 0',
                borderRadius: 28, border: '1px dashed var(--hair-160)',
                background: 'linear-gradient(155deg, rgba(var(--accent-rgb),.06), rgba(var(--role-fan-rgb),.05))',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-a40)', border: '1px solid var(--line-2)', borderRadius: 9999, padding: '5px 11px' }}>{t('listenHome.seedsEmptyBadge', 'No new seeds')}</span>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-.03em', color: 'var(--ink-a55)', lineHeight: 1 }}>{t('listenHome.seedsEmptyTitle', 'Fresh drops land here')}</div>
                <p style={{ fontSize: 13, color: 'var(--ink-a45)', margin: 0 }}>{t('listenHome.seedsEmptyBody', 'New seeds appear as artists upload. Check back soon.')}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 24, opacity: 0.35, pointerEvents: 'none' }} aria-hidden="true">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--hair-120)', background: 'var(--hair-40)' }}>✕</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>{t('listenHome.seedsSkipLabel', 'Skip')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(var(--role-venue-rgb),.4)', background: 'rgba(var(--role-venue-rgb),.14)' }}>+</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>{t('listenHome.seedsSaveLabel', 'Save to library')}</span>
                </div>
              </div>
            </div>
          ) : (
            <SeedDeck onAct={actOnSeed} seeds={filteredSeeds} />
          )}
        </div>
      )}

      {/* RADIO */}
      {tab === 'radio' && (
        <div className="sub-panel">
          {radio === null && <CardSkeleton />}
          {radio !== null && !liveShow && upcomingShows.length === 0 && (
            <div style={{ border: '1px dashed var(--line-2)', borderRadius: 16, padding: 20, background: 'var(--hair-20)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a40)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-a25)' }} /> {t('listenHome.radioOffAir', 'OFF AIR')}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4, color: 'var(--ink-a55)' }}>{t('listenHome.radioNoShowsTitle', 'No shows on air')}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-a45)', marginBottom: 16 }}>{t('listenHome.radioNoShowsBody', 'DJs go live on audio — scheduled shows appear here.')}</div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <Link href="/radio" style={bGhost}>{t('listenHome.radioViewStation', 'View the station')}</Link>
              </div>
            </div>
          )}
          {liveShow && (
            <div style={{ border: '1px solid var(--hair-70)', borderRadius: 16, padding: 20, background: 'var(--hair-30)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a50)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'ihype-blink 1.2s ease-in-out infinite' }} /> {t('listenHome.radioLiveNow', 'LIVE NOW')}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{liveShow.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-a60)', marginBottom: 16 }}>{liveShow.headlinerProfile?.name ?? t('listenHome.radioDefaultStationName', 'iHYPE Radio')}</div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <Link href="/radio" style={bSolid}>{t('listenHome.radioTuneIn', 'Tune In')}</Link>
              </div>
            </div>
          )}
          {upcomingShows.map((s) => (
            <div key={s.id} style={{ border: '1px solid var(--hair-70)', borderRadius: 16, padding: 20, background: 'var(--hair-30)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a50)', marginBottom: 10 }}>{timeLabel(s.startsAt)}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-a60)', marginBottom: 16 }}>{s.headlinerProfile?.name ?? t('listenHome.radioDefaultStationName', 'iHYPE Radio')}</div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <Link href="/radio" style={bGhost}>{t('listenHome.radioViewSchedule', 'View schedule')}</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHARTS */}
      {tab === 'charts' && (
        <div className="sub-panel">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { id: 'forYou' as const, label: t('listenHome.chartsScopeForYou', 'For You') },
              { id: 'local' as const, label: t('listenHome.chartsScopeLocal', 'Local') },
              { id: 'national' as const, label: t('listenHome.chartsScopeNational', 'National') },
            ].map((s) => (
              <div
                key={s.id}
                onClick={() => setChartScope(s.id)}
                style={{ fontSize: 12, padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', border: `1px solid ${chartScope === s.id ? 'rgba(var(--accent-rgb),.4)' : 'var(--hair-100)'}`, background: chartScope === s.id ? 'rgba(var(--accent-rgb),.12)' : 'var(--hair-30)', color: chartScope === s.id ? 'var(--ink)' : 'var(--ink-a60)' }}
              >
                {s.label}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {chartGenres.map((g) => (
              <div
                key={g}
                onClick={() => setChartGenre(g)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 11px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${chartGenre === g ? 'var(--hair-280)' : 'var(--hair-80)'}`, color: chartGenre === g ? 'var(--ink)' : 'var(--ink-a55)' }}
              >
                {g}
              </div>
            ))}
          </div>
          <div style={panel}>
            <div style={panelHead}>{t('listenHome.chartsLeaderboardHeading', 'Hype Leaderboard · Last 7 days')}</div>
            {charts === null && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={chartRow}>
                <div className="ihype-skeleton" style={{ width: 26, height: 18, borderRadius: 4, flexShrink: 0 }} />
                <div className="ihype-skeleton" style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                  <div className="ihype-skeleton" style={{ width: `${50 - i * 5}%`, height: 15, borderRadius: 5 }} />
                  <div className="ihype-skeleton" style={{ width: `${30 - i * 3}%`, height: 11, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            {charts !== null && filteredChartRows.length === 0 && <div style={{ ...emptyStyle, padding: '32px 20px' }}><p>{t('listenHome.chartsEmpty', 'No tracks charting here yet.')}</p></div>}
            {filteredChartRows.map((c, i) => (
              <Link key={c.id} href={`/artists/${c.artistSlug}`} style={{ ...chartRow, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, width: 26, color: 'var(--ink-a20)', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ width: 5, height: 36, borderRadius: 3, flexShrink: 0, background: c.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={rowTitle}>{c.title}</div>
                  <div style={rowSubtitle}>{c.artistName}{c.city ? ` · ${c.city}` : ''}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', color: 'var(--accent)', flexShrink: 0 }}>{c.hypeCount.toLocaleString()}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* PLAYLISTS */}
      {tab === 'playlists' && !openPl && (
        <div className="sub-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>
              {t('listenHome.playlistsHeading', 'Your Playlists')} · {playlists?.length ?? 0}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                onChange={(e) => setNewPlName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createPlaylist(); }}
                placeholder={t('listenHome.newPlaylistPlaceholder', 'New playlist name')}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--hair-100)', background: 'var(--hair-30)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--font-body)' }}
                type="text"
                value={newPlName}
              />
              <button onClick={createPlaylist} style={bGhost} type="button">{t('listenHome.newPlaylistButton', '+ New')}</button>
            </div>
          </div>

          {playlists === null && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={panel}>
                  <div className="ihype-skeleton" style={{ height: 90, borderRadius: 0 }} />
                  <div style={{ padding: '16px 18px 18px', display: 'grid', gap: 8 }}>
                    <div className="ihype-skeleton" style={{ width: '70%', height: 16, borderRadius: 5 }} />
                    <div className="ihype-skeleton" style={{ width: '40%', height: 12, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {playlists !== null && playlists.length === 0 && (
            <div style={{ marginBottom: 12 }}>
              <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ border: '1px dashed var(--hair-120)', borderRadius: 16, overflow: 'hidden', background: 'var(--hair-15)' }}>
                    <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${PALETTE[i]}14 0%, transparent 100%)`, borderBottom: '1px solid var(--hair-40)', fontSize: 28, opacity: 0.4 }}>🎵</div>
                    <div style={{ padding: '16px 18px 18px' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 2, color: 'var(--ink-a30)' }}>{i === 0 ? t('listenHome.playlistsEmptyCardFirst', 'Your first playlist') : t('listenHome.playlistsEmptyCardMore', 'Room for more')}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-a25)' }}>{t('listenHome.playlistsEmptyCardTrackCount', '0 tracks')}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-a50)', marginTop: 16 }}>{t('listenHome.playlistsEmptyHint', 'No playlists yet — name one above to get started.')}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {(playlists ?? []).map((p, i) => (
              <div key={p.id} onClick={() => setOpenPl(p.id)} style={{ ...panel, cursor: 'pointer' }}>
                <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${PALETTE[i % PALETTE.length]}33 0%, transparent 100%)`, borderBottom: '1px solid var(--hair-50)', fontSize: 28 }}>🎵</div>
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-a50)' }}>{p.items.length} {p.items.length === 1 ? t('listenHome.trackSingular', 'track') : t('listenHome.trackPlural', 'tracks')}</div>
                </div>
              </div>
            ))}
          </div>

          {savedSeeds.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginBottom: 12 }}>{t('listenHome.discoverSavedFromSeedsHeading', 'Discover · saved from Seeds')}</div>
              <div style={panel}>
                {savedSeeds.map((s) => (
                  <Link key={s.id} href={profileHref(s.artistProfileType, s.artistProfileSlug)} style={{ ...chartRow, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={rowTitle}>{s.title}</div><div style={rowSubtitle}>{s.artistName}</div></div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {favorites.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginBottom: 12 }}>{t('listenHome.favoritesHeading', 'Favorites')}</div>
              <div style={panel}>
                {favorites.map((f) => (
                  f.artistProfileSlug ? (
                    <Link key={f.id} href={`/artists/${f.artistProfileSlug}`} style={{ ...chartRow, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={rowTitle}>{f.title}</div><div style={rowSubtitle}>{f.artistName}</div></div>
                    </Link>
                  ) : (
                    <div key={f.id} style={chartRow}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={rowTitle}>{f.title}</div><div style={rowSubtitle}>{f.artistName}</div></div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PLAYLIST DETAIL */}
      {tab === 'playlists' && openPl && openPlaylist && (
        <div className="sub-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => setOpenPl(null)} style={bGhost} type="button">{t('listenHome.playlistDetailBack', '← Back')}</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => shareLink(openPlaylist.id)} style={bGhost} type="button">{t('listenHome.playlistDetailShare', 'Share')}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(var(--accent-rgb),.3) 0%, transparent 100%)', border: '1px solid var(--line)', fontSize: 28 }}>🎵</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>{openPlaylist.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-a50)', marginTop: 2 }}>{openPlaylist.items.length} {openPlaylist.items.length === 1 ? t('listenHome.trackSingular', 'track') : t('listenHome.trackPlural', 'tracks')}</div>
            </div>
          </div>
          <div style={panel}>
            {openPlaylist.items.length === 0 && <div style={{ ...emptyStyle, padding: '32px 20px' }}><p>{t('listenHome.playlistDetailEmpty', 'No tracks yet — add tracks from the media player while listening.')}</p></div>}
            {openPlaylist.items.map((it, i) => {
              const isDragging = dragState && dragState.index === i;
              const isOver = dragState && dragState.overIndex === i && dragState.index !== i;
              return (
                <div
                  key={it.id}
                  ref={(el) => { rowRefsRef.current[i] = el; }}
                  style={{
                    ...chartRow,
                    opacity: isDragging ? 0.4 : 1,
                    borderTop: isOver && dragState && dragState.overIndex < dragState.index ? '2px solid var(--accent)' : '2px solid transparent',
                    borderBottom: isOver && dragState && dragState.overIndex > dragState.index ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <div
                    onPointerDown={(e) => onGripPointerDown(openPlaylist.id, i, e)}
                    style={{ cursor: 'grab', touchAction: 'none', color: 'var(--ink-a30)', flexShrink: 0 }}
                    title={t('listenHome.playlistDetailDragToReorder', 'Drag to reorder')}
                  >
                    <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14"><circle cx="8" cy="6" r="1.6" /><circle cx="16" cy="6" r="1.6" /><circle cx="8" cy="12" r="1.6" /><circle cx="16" cy="12" r="1.6" /><circle cx="8" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" /></svg>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, width: 22, color: 'var(--ink-a20)', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-a50)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.artistName}</div>
                  </div>
                  <button onClick={() => removeItem(openPlaylist.id, it.id)} style={{ ...bGhost, padding: '6px 12px', fontSize: 12 }} type="button">{t('listenHome.playlistDetailRemove', 'Remove')}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
      </PullToRefresh>
    </div>
  );
}
