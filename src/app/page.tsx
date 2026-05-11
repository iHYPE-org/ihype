'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';

// ── Demo data ────────────────────────────────────────────────────

const DEMO_TRACKS: MediaTrack[] = [
  { id: '1', title: 'Sundown', artistName: 'Maya Reyes', url: '', artworkUrl: null, mediaId: null },
  { id: '2', title: 'Westline', artistName: 'Cobalt Hour', url: '', artworkUrl: null, mediaId: null },
  { id: '3', title: 'Gold Teeth', artistName: 'Vela', url: '', artworkUrl: null, mediaId: null },
  { id: '4', title: 'Slow Burn', artistName: 'The Lowriders', url: '', artworkUrl: null, mediaId: null },
  { id: '5', title: 'Cassette Heart', artistName: 'Juno North', url: '', artworkUrl: null, mediaId: null },
  { id: '6', title: 'Underpass', artistName: 'Saint Hex', url: '', artworkUrl: null, mediaId: null },
];

const TRACK_META: Record<string, { dur: string; hype: number; c: string }> = {
  '1': { dur: '3:24', hype: 142, c: '#ff5029' },
  '2': { dur: '4:11', hype: 89, c: '#b983ff' },
  '3': { dur: '2:58', hype: 67, c: '#22e5d4' },
  '4': { dur: '3:42', hype: 211, c: '#ff3e9a' },
  '5': { dur: '3:09', hype: 54, c: '#ffb84a' },
  '6': { dur: '4:36', hype: 128, c: '#7fb3ff' },
};

const SHOWS = [
  { name: 'Maya Reyes', venue: 'Empty Bottle', date: 'Thu Jun 18', time: '9PM', hype: 412, status: 'LIVE' as const },
  { name: 'Cobalt Hour', venue: 'Sleeping Village', date: 'Sat Jun 20', time: '8PM', hype: 287, status: 'SOON' as const },
  { name: 'Vela', venue: 'Subterranean', date: 'Tue Jun 23', time: '8PM', hype: 156, status: 'OPEN' as const },
  { name: 'Saint Hex', venue: 'Schubas', date: 'Fri Jun 26', time: '10PM', hype: 98, status: 'OPEN' as const },
  { name: 'Juno North', venue: 'The Hideout', date: 'Sat Jun 27', time: '9PM', hype: 74, status: 'OPEN' as const },
];

const ACTIVITY = [
  { text: '3 new hypes on Sundown', time: '2m ago', c: '#ff5029' },
  { text: 'Cobalt Hour confirmed for Sat Jun 20', time: '14m ago', c: '#22e5d4' },
  { text: 'DJ Vex spun Sundown on Chicago Underground', time: '1h ago', c: '#b983ff' },
  { text: 'Payout $2,460 scheduled for Jun 24', time: '3h ago', c: '#ffb84a' },
  { text: 'Sleeping Village wants a date in August', time: 'today', c: '#ff3e9a' },
];

const ROLES = [
  { k: 'fan', label: 'Fan', sub: 'Hype · Top 5 · Playlists', c: '#b983ff', active: true },
  { k: 'artist', label: 'Artist', sub: 'Upload · Tour · Merch', c: '#ff5029', active: true },
  { k: 'venue', label: 'Venue', sub: 'Host · Verify · Issue tickets', c: '#22e5d4', active: false },
  { k: 'promoter', label: 'Promoter / DJ', sub: 'Book · Affiliate · Radio shows', c: '#ff3e9a', active: false },
];

const RADIO = [
  { name: 'Late Night Locals', host: 'DJ Ramona', listeners: 84, c: '#ff3e9a' },
  { name: 'Crate Digger Hour', host: 'Saint Hex', listeners: 62, c: '#7fb3ff' },
  { name: 'Midwest Frequencies', host: 'Cobalt Hour', listeners: 48, c: '#b983ff' },
  { name: 'Underground Dispatch', host: 'Vela', listeners: 31, c: '#22e5d4' },
];

const NAV_ITEMS = [
  { id: 'discover', icon: '⌕', label: 'Discover' },
  { id: 'library', icon: '☰', label: 'Library' },
  { id: 'shows', icon: '◇', label: 'Shows' },
  { id: 'radio', icon: '◉', label: 'Radio' },
  { id: 'studio', icon: '◐', label: 'Studio' },
];

type View = 'discover' | 'library' | 'shows' | 'radio' | 'studio';

// ── Sub-components ───────────────────────────────────────────────

function TrackCard({ track, onPlay, isActive }: { track: MediaTrack; onPlay: () => void; isActive: boolean }) {
  const meta = TRACK_META[track.id];
  if (!meta) return null;
  return (
    <div className="wb-track-card" data-active={isActive} onClick={onPlay} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPlay()}
      style={{ '--card-c': meta.c } as React.CSSProperties}
    >
      <div className="wb-track-art" style={{ background: `linear-gradient(135deg, ${meta.c}, ${meta.c}66)` }}>
        {isActive && <div className="wb-track-art-playing"><span /><span /><span /></div>}
        <button className="wb-track-play-btn" aria-label={`Play ${track.title}`} type="button">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>
        </button>
      </div>
      <div className="wb-track-meta">
        <div className="wb-track-title">{track.title}</div>
        <div className="wb-track-artist">{track.artistName}</div>
        <div className="wb-track-info">
          <span className="wb-hype-badge" style={{ color: meta.c }}>♡ {meta.hype}</span>
          <span className="wb-track-dur">{meta.dur}</span>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: 'LIVE' | 'SOON' | 'OPEN' }) {
  const colors = { LIVE: '#22e5d4', SOON: '#ffb84a', OPEN: 'var(--muted)' };
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: colors[status], flexShrink: 0 }} />;
}

function ViewDiscover({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  const { playTrack, currentTrack } = useMediaPlayer();
  const playAll = useCallback((track: MediaTrack) => {
    playTrack(track, DEMO_TRACKS);
  }, [playTrack]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = session?.user?.name?.split(' ')[0] ?? null;

  return (
    <div className="wb-discover">
      {/* Greeting */}
      <div className="wb-greeting">
        <h1 className="wb-greeting-h">
          {firstName ? `${greeting}, ${firstName}.` : 'Independent music, found by humans.'}
        </h1>
        <p className="wb-greeting-sub">
          {firstName
            ? '3 new hypes on Sundown. Cobalt Hour opens for you Saturday at Sleeping Village.\nTwo venues asked about August.'
            : 'Not-for-profit · free forever · built for the scene. '}
          {!firstName && <Link href="/register" className="wb-link-ember">Join free →</Link>}
        </p>
        {firstName && (
          <div className="wb-greeting-actions">
            <Link href="/artists/upload" className="wb-btn-primary">+ Upload a track</Link>
            <Link href="/shows/plan" className="wb-btn-ghost">Plan a tour ›</Link>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="wb-stat-row">
        {[
          { label: 'ALL TIME PLAYS', val: '1,247', delta: '+12% vs last wk', dc: '#22e5d4' },
          { label: 'SHOWS SOON', val: '184', delta: '↑ 12 today', dc: '#ffb84a' },
          { label: 'MUSIC PLAYS', val: '3,891', delta: 'across 6 shows', dc: '#22e5d4' },
          { label: 'PAYOUT PENDING', val: '$2,460', delta: 'releases Jun 24', dc: '#b983ff' },
        ].map((s) => (
          <div key={s.label} className="wb-stat">
            <div className="wb-stat-label">{s.label}</div>
            <div className="wb-stat-val">{s.val}</div>
            <div className="wb-stat-delta" style={{ color: s.dc }}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Shows + Activity row */}
      <div className="wb-panel-row">
        <div className="wb-panel">
          <div className="wb-panel-head">
            <span>Tonight in Chicago</span>
            <Link href="/shows" className="wb-panel-link">ALL SHOWS →</Link>
          </div>
          <div className="wb-panel-body">
            {SHOWS.slice(0, 3).map((s, i) => (
              <div key={i} className="wb-show-row">
                <StatusDot status={s.status} />
                <div className="wb-show-info">
                  <span className="wb-show-name">{s.name}</span>
                  <span className="wb-show-venue">{s.venue}</span>
                </div>
                <div className="wb-show-right">
                  <span className="wb-show-time">{s.date} · {s.time}</span>
                  <span className="wb-show-hype">♡ {s.hype}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="wb-panel">
          <div className="wb-panel-head">
            <span>Activity</span>
            <button className="wb-panel-link" type="button">MARK READ</button>
          </div>
          <div className="wb-panel-body">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="wb-activity-row">
                <span className="wb-activity-dot" style={{ background: a.c }} />
                <span className="wb-activity-text">{a.text}</span>
                <span className="wb-activity-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hyped this week — large card grid */}
      <div className="wb-section">
        <div className="wb-section-head">
          <span>Hyped this week</span>
          <Link href="/artists" className="wb-panel-link">DISCOVER ALL →</Link>
        </div>
        <div className="wb-card-grid">
          {DEMO_TRACKS.map((t) => (
            <TrackCard
              key={t.id}
              track={t}
              isActive={currentTrack?.id === t.id}
              onPlay={() => playAll(t)}
            />
          ))}
        </div>
      </div>

      {/* Your roles */}
      <div className="wb-section">
        <div className="wb-section-head">
          <span>Your roles</span>
          <span className="wb-panel-link">{ROLES.filter(r => r.active).length} ACTIVE · {ROLES.filter(r => !r.active).length} AVAILABLE</span>
        </div>
        <div className="wb-role-row">
          {ROLES.map((r) => (
            <div key={r.k} className="wb-role-card" style={{ '--role-c': r.c } as React.CSSProperties}>
              <div className="wb-role-top">
                <span className="wb-role-label">{r.label}</span>
                {r.active
                  ? <span className="wb-role-badge active">✓ active</span>
                  : <Link href={`/register?role=${r.k}`} className="wb-role-badge add">add →</Link>
                }
              </div>
              <div className="wb-role-sub">{r.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ViewLibrary() {
  const { playTrack, currentTrack } = useMediaPlayer();
  return (
    <div className="wb-discover">
      <div className="wb-greeting">
        <h1 className="wb-greeting-h">Your Library</h1>
        <p className="wb-greeting-sub">Playlists, hyped tracks, and saved shows live here once you sign in.</p>
        <div className="wb-greeting-actions">
          <Link href="/register" className="wb-btn-primary">Create account</Link>
          <Link href="/login" className="wb-btn-ghost">Sign in</Link>
        </div>
      </div>
      <div className="wb-section">
        <div className="wb-section-head"><span>Popular playlists</span><span className="wb-panel-link">PREVIEW</span></div>
        <div className="wb-panel">
          <div className="wb-panel-body">
            {[
              { name: 'Chicago Locals 2026', tracks: 24, curator: 'iHYPE Staff', c: '#ff5029' },
              { name: 'Late Night Hypno', tracks: 18, curator: 'DJ Ramona', c: '#b983ff' },
              { name: 'Midwest Emerging', tracks: 31, curator: 'Saint Hex', c: '#22e5d4' },
            ].map((pl, i) => (
              <div key={i} className="wb-show-row">
                <div style={{ width: 28, height: 28, borderRadius: 4, background: `linear-gradient(135deg,${pl.c},${pl.c}66)`, flexShrink: 0 }} />
                <div className="wb-show-info">
                  <span className="wb-show-name">{pl.name}</span>
                  <span className="wb-show-venue">by {pl.curator}</span>
                </div>
                <span className="wb-show-hype">{pl.tracks} tracks</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="wb-section">
        <div className="wb-section-head"><span>Recently played</span></div>
        <div className="wb-card-grid">
          {DEMO_TRACKS.slice(0, 4).map((t) => (
            <TrackCard key={t.id} track={t} isActive={currentTrack?.id === t.id} onPlay={() => playTrack(t, DEMO_TRACKS)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ViewShows() {
  return (
    <div className="wb-discover">
      <div className="wb-greeting">
        <h1 className="wb-greeting-h">Shows</h1>
        <p className="wb-greeting-sub">Upcoming and live events near you.</p>
        <div className="wb-greeting-actions">
          <Link href="/register?role=venue" className="wb-btn-primary">List a show</Link>
          <Link href="/shows" className="wb-btn-ghost">Browse all cities</Link>
        </div>
      </div>
      <div className="wb-panel">
        <div className="wb-panel-head"><span>ALL UPCOMING</span><span className="wb-panel-link">{SHOWS.length} SHOWS</span></div>
        <div className="wb-panel-body">
          {SHOWS.map((s, i) => (
            <div key={i} className="wb-show-row">
              <StatusDot status={s.status} />
              <div className="wb-show-info">
                <span className="wb-show-name">{s.name}</span>
                <span className="wb-show-venue">{s.venue}</span>
              </div>
              <div className="wb-show-right">
                <span className={`wb-status-badge wb-status-${s.status.toLowerCase()}`}>{s.status}</span>
                <span className="wb-show-time">{s.date} · {s.time}</span>
                <span className="wb-show-hype">♡ {s.hype}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ViewRadio() {
  return (
    <div className="wb-discover">
      <div className="wb-greeting">
        <h1 className="wb-greeting-h">Radio</h1>
        <p className="wb-greeting-sub">Live and recorded sets from local artists and DJs.</p>
      </div>
      <div className="wb-stat-row">
        {RADIO.map((r, i) => (
          <div key={i} className="wb-stat wb-radio-card" style={{ '--card-c': r.c, cursor: 'pointer' } as React.CSSProperties}>
            <div className="wb-radio-bar" style={{ background: r.c }} />
            <div className="wb-stat-label">LIVE</div>
            <div className="wb-radio-name">{r.name}</div>
            <div className="wb-radio-host">with {r.host}</div>
            <div className="wb-radio-listeners" style={{ color: r.c }}>● {r.listeners} listening</div>
          </div>
        ))}
      </div>
      <div className="wb-section">
        <div className="wb-section-head"><span>Recent sets</span><span className="wb-panel-link">ARCHIVE</span></div>
        <div className="wb-panel">
          <div className="wb-panel-body">
            {DEMO_TRACKS.slice(0, 3).map((t, i) => (
              <div key={i} className="wb-show-row">
                <span className="wb-activity-dot" style={{ background: TRACK_META[t.id]?.c }} />
                <div className="wb-show-info">
                  <span className="wb-show-name">{t.artistName} — Live Set</span>
                  <span className="wb-show-venue">{TRACK_META[t.id]?.dur}</span>
                </div>
                <span className="wb-show-time">May {10 + i}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewStudio() {
  return (
    <div className="wb-discover">
      <div className="wb-greeting">
        <h1 className="wb-greeting-h">Studio</h1>
        <p className="wb-greeting-sub">Upload tracks, manage your shows, and track hype as an artist.</p>
      </div>
      <div className="wb-role-row" style={{ marginBottom: 24 }}>
        {[
          { icon: '◐', label: 'Upload Track', sub: 'Stream-quality audio, no limits', c: '#ff5029', href: '/register?role=artist' },
          { icon: '◇', label: 'List a Show', sub: 'Tickets, RSVP, or free entry', c: '#22e5d4', href: '/register?role=venue' },
          { icon: '◉', label: 'Start Radio', sub: 'Live or recorded DJ sets', c: '#ff3e9a', href: '/register?role=promoter' },
          { icon: '☰', label: 'Artist Profile', sub: 'Bio, links, press kit', c: '#b983ff', href: '/register?role=artist' },
        ].map((item, i) => (
          <Link key={i} href={item.href} className="wb-role-card" style={{ '--role-c': item.c, textDecoration: 'none' } as React.CSSProperties}>
            <div className="wb-role-top">
              <span style={{ fontSize: 20, color: item.c }}>{item.icon}</span>
            </div>
            <div className="wb-role-label">{item.label}</div>
            <div className="wb-role-sub">{item.sub}</div>
          </Link>
        ))}
      </div>
      <div className="wb-cta-banner">
        <div className="wb-cta-banner-text">
          <strong>iHYPE is free for artists.</strong>
          <span>No streaming cuts. No paywalls. Built by and for the independent music scene.</span>
        </div>
        <Link href="/register?role=artist" className="wb-btn-primary">Get started free →</Link>
      </div>
    </div>
  );
}

// ── Right panel: queue ───────────────────────────────────────────

function RightPanel() {
  const { currentTrack, playTrack, isPlaying } = useMediaPlayer();
  return (
    <div className="wb-right">
      <div className="wb-right-head">Queue</div>
      {currentTrack && (
        <div className="wb-right-now">
          <div className="wb-right-now-art" style={{ background: `linear-gradient(135deg,${TRACK_META[currentTrack.id]?.c ?? '#ff5029'},${TRACK_META[currentTrack.id]?.c ?? '#ff5029'}66)` }} />
          <div>
            <div className="wb-right-now-title">{currentTrack.title}</div>
            <div className="wb-right-now-artist">{currentTrack.artistName}</div>
          </div>
        </div>
      )}
      <div className="wb-right-label">UP NEXT · {DEMO_TRACKS.length} TRACKS</div>
      {DEMO_TRACKS.map((t) => {
        const meta = TRACK_META[t.id];
        const active = currentTrack?.id === t.id;
        return (
          <button
            key={t.id}
            className="wb-queue-item"
            data-active={active}
            onClick={() => playTrack(t, DEMO_TRACKS)}
            type="button"
          >
            <div className="wb-queue-art" style={{ background: `linear-gradient(135deg,${meta?.c},${meta?.c}66)` }} />
            <div className="wb-queue-info">
              <div className="wb-queue-title">{t.title}</div>
              <div className="wb-queue-artist">{t.artistName}</div>
            </div>
            <div className="wb-queue-dur">{meta?.dur}</div>
          </button>
        );
      })}
    </div>
  );
}

// ── Root component ───────────────────────────────────────────────

export default function LandingPage() {
  const [view, setView] = useState<View>('discover');
  const [hovered, setHovered] = useState<string | null>(null);
  const { data: session } = useSession();

  return (
    <>
      <style>{`
        @keyframes lp-fadein { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes bars { 0%,100%{height:4px} 50%{height:12px} }
        .wb-track-art-playing span { display:inline-block; width:3px; border-radius:2px; background:currentColor; animation:bars .8s ease-in-out infinite; }
        .wb-track-art-playing span:nth-child(2) { animation-delay:.15s; }
        .wb-track-art-playing span:nth-child(3) { animation-delay:.3s; }
      `}</style>

      <div className="wb-wrap">
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className="wb-sidebar">
          {NAV_ITEMS.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                className="wb-nav-btn"
                data-active={active}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setView(n.id as View)}
                type="button"
                aria-label={n.label}
              >
                {active && <span className="wb-nav-indicator" />}
                <span className="wb-nav-icon">{n.icon}</span>
                {hovered === n.id && <span className="wb-nav-tooltip">{n.label}</span>}
              </button>
            );
          })}
          <div className="wb-sidebar-foot">
            {!session?.user && (
              <Link href="/login" className="wb-sidebar-signin">↑<br />in</Link>
            )}
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────── */}
        <main key={view} className="wb-main">
          {view === 'discover' && <ViewDiscover session={session} />}
          {view === 'library' && <ViewLibrary />}
          {view === 'shows' && <ViewShows />}
          {view === 'radio' && <ViewRadio />}
          {view === 'studio' && <ViewStudio />}
        </main>

        {/* ── Right panel ─────────────────────────────────────── */}
        <RightPanel />
      </div>
    </>
  );
}
