'use client';

import React, { useState, useEffect } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShellV2';
import type { WbTicket, WbTrendingProfile } from '@/types/workbench';
import { IcHeart } from './icons';
import { Panel, TrackCard } from './primitives';

const STUB_ACCENT_PALETTE = ['#ff5029', '#b983ff', '#22e5d4', '#ff3e9a', '#ffb84a', '#4af0b0'];

function TicketStubQR({ code }: { code: string }) {
  const SIZE = 9;
  // Seed a simple hash from the code string for deterministic pixel pattern
  const hash = (s: string, seed: number) => {
    let h = seed;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
  };
  // Fixed corner squares (finder pattern positions for QR-like appearance)
  const corners = new Set([0,1,2,3,4,5,6,7,8,9,14,15,16,17,18,63,72,73,74,75,76,77,78]);
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => {
    if (corners.has(i)) return true;
    return (hash(code, i) ^ (i * 0x5f3759df)) % 3 !== 0;
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE},1fr)`, gap: 1.5, width: 48, height: 48, flexShrink: 0 }}>
      {cells.map((on, i) => (
        <div key={i} style={{ borderRadius: 1, background: on ? '#fff' : 'transparent' }} />
      ))}
    </div>
  );
}

function TicketStub({ ticket, accentColor }: { ticket: WbTicket; accentColor: string }) {
  const dateStr = new Date(ticket.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      borderRadius: '8px 8px 0 0',
      border: '1px solid var(--line-2)',
      borderBottom: '2px dashed var(--line-2)',
      background: `repeating-linear-gradient(135deg, var(--bg-2) 0px, var(--bg-2) 8px, var(--bg-3) 8px, var(--bg-3) 9px)`,
      overflow: 'hidden',
      minHeight: 90,
    }}>
      {/* Left accent strip */}
      <div style={{ width: 4, background: accentColor, flexShrink: 0 }} />
      {/* Main content */}
      <div style={{ flex: 1, padding: '10px 12px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>{ticket.showName}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>{dateStr}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Chicago, IL · {ticket.seat}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: 8 }}>
          iHYPE • NO PLATFORM FEE • 45/45/10
        </div>
      </div>
      {/* Dashed divider */}
      <div style={{ width: 1, borderLeft: '2px dashed var(--line-2)', margin: '8px 0', flexShrink: 0 }} />
      {/* QR side */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <TicketStubQR code={ticket.code} />
      </div>
    </div>
  );
}

// ── Trending artist card ────────────────────────────────────────
const COVER_GRADIENTS = [
  'linear-gradient(135deg,#c83a18,#e89060)',
  'linear-gradient(135deg,#1a8278,#7fc4c0)',
  'linear-gradient(135deg,#7a3fb5,#c08fe8)',
  'linear-gradient(135deg,#3a60c8,#90bce8)',
  'linear-gradient(135deg,#c83a6a,#e890b0)',
  'linear-gradient(135deg,#3a7ac8,#90c8e8)',
];

function TrendingCard({ artist, idx }: { artist: WbTrendingProfile; idx: number }) {
  const [hyped, setHyped] = useState(false);
  const [count, setCount] = useState(artist.hypeCount);
  const gradient = artist.avatarImage
    ? undefined
    : COVER_GRADIENTS[idx % COVER_GRADIENTS.length];
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{
        height: 100, position: 'relative',
        background: gradient ?? `url(${artist.avatarImage}) center/cover`,
        display: 'flex', alignItems: 'flex-end', padding: '8px 10px', gap: 6,
      }}>
        <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', padding: '2px 7px', borderRadius: 99, color: '#fff', border: '1px solid rgba(255,255,255,.12)' }}>
          {artist.type}
        </span>
        {artist.genre && (
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(4px)', color: '#ccc', padding: '2px 7px', borderRadius: 99 }}>
            {artist.genre}
          </span>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{artist.name}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{artist.city || 'Location unknown'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 2 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{count.toLocaleString()}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 1 }}>hypes</div>
          </div>
          <button
            onClick={() => {
              if (hyped) return;
              setHyped(true);
              setCount(c => c + 1);
              fetch('/api/hype', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetType: 'profile', targetId: artist.id }),
              }).catch(() => {});
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'var(--f-b)',
              border: hyped ? '2px solid transparent' : '2px solid rgba(255,80,41,.5)',
              background: hyped ? 'linear-gradient(135deg,#ff5029,#ff3e9a)' : 'rgba(255,80,41,.1)',
              color: hyped ? '#fff' : 'var(--accent)', cursor: 'pointer', minHeight: 'unset',
            }}
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>
            {hyped ? 'Hyped!' : 'Hype'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recent Hypers sidebar panel ─────────────────────────────────
type RecentHyperEntry = { hexId: string; createdAt: string };

function RecentHypers({ profileId }: { profileId?: string }) {
  const [hypers, setHypers] = useState<RecentHyperEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profileId) { setLoaded(true); return; }
    fetch(`/api/hype/recent?profileId=${profileId}`)
      .then(r => r.ok ? r.json() : [])
      .then((d: RecentHyperEntry[]) => { setHypers(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [profileId]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 12 }}>Recent Hypers</div>
      {!loaded && (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-4)' }}>Loading…</div>
      )}
      {loaded && hypers.length === 0 && (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-4)' }}>No hypers yet</div>
      )}
      {loaded && hypers.map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < hypers.length - 1 ? '1px solid var(--line)' : 'none' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#22e5d4', letterSpacing: '.04em' }}>{h.hexId}</span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-4)' }}>{timeAgo(h.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

export function ViewMyPage({ data, onPickTrack, currentIdx }: {
  data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number;
}) {
  const [hypedIds, setHypedIds] = useState<Set<string>>(new Set());
  const [referral, setReferral] = useState<{ link: string; count: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [anniversaryDismissed, setAnniversaryDismissed] = useState(false);
  const [streakData, setStreakData] = useState<{ streak: number; daysActive: number } | null>(null);

  const handleHype = async (showId: string) => {
    if (hypedIds.has(showId)) return; // already hyped
    setHypedIds(prev => new Set([...prev, showId]));
    try {
      await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'show', targetId: showId }),
      });
    } catch {
      // revert on failure
      setHypedIds(prev => { const n = new Set(prev); n.delete(showId); return n; });
    }
  };
  useEffect(() => {
    fetch('/api/referral')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.referralLink) setReferral({ link: d.referralLink, count: d.referralCount ?? 0 }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/hype-streak')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStreakData({ streak: d.streak ?? 0, daysActive: d.daysActive ?? 0 }); })
      .catch(() => {});
  }, []);

  const heroStats = [
    { v: (data.lifeStats?.totalHype ?? 1284).toLocaleString(), k: 'HYPE Given', accent: true },
    { v: '842', k: 'Received', accent: false },
    { v: String(data.lifeStats?.eventsAttended ?? 23), k: 'Shows Attended', accent: false },
    { v: '7', k: 'Top-5 Slots', accent: false },
  ];

  const trendingArtists = (data.trending ?? []).slice(0, 3);

  return (
    <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>

      {data.degraded && (
        <div style={{ marginBottom: 16, padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,184,74,.25)', background: 'rgba(255,184,74,.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: '#ffb84a' }}>Some data couldn't load — you're seeing a cached view. Refresh to retry.</span>
        </div>
      )}

      {/* Hero — 3-col grid */}
      <div className="me-hero-grid" style={{
        display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 28, alignItems: 'center',
        padding: 26, borderRadius: 14,
        background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))',
        border: '1px solid var(--line-2)', position: 'relative', overflow: 'hidden', marginBottom: 28,
      }}>
        {/* Radial glow */}
        <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '50%', height: '200%', background: 'radial-gradient(ellipse, rgba(255,80,41,.18), transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
        {/* Portrait */}
        <div style={{
          width: 200, height: 200, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent) 0%, #ff3e9a 50%, #b983ff 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 90, color: '#0a0805', letterSpacing: '-.04em', mixBlendMode: 'overlay', opacity: .85, lineHeight: 1 }}>{data.userInitials}</span>
        </div>

        {/* Identity col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            {data.activeProfileTypes.slice(0, 2).map(r => {
              const roleColors: Record<string, string> = { LISTENER: '#b983ff', ARTIST: '#ff5029', VENUE: '#22e5d4', DJ: '#ff3e9a' };
              const c = roleColors[r] ?? '#9e9080';
              return (
                <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--line-2)', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: 'var(--ink)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />{r}
                </span>
              );
            })}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 99, background: 'rgba(255,184,74,.12)', border: '1px solid rgba(255,184,74,.28)', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: '#ffb84a' }}>⚡ LEVEL 14</span>
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 46, letterSpacing: '-.03em', lineHeight: .95, margin: 0, color: 'var(--ink)' }}>{data.userName}</h1>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.08em' }}>@{data.userName.toLowerCase().replace(/\s/g, '.')} · {data.city} · Joined Mar &apos;25</div>
          <p style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4, maxWidth: '50ch' }}>Halflight EP out now. Writing the next thing in a basement on Western Ave. Recommendations open.</p>
        </div>

        {/* Stats 2×2 grid */}
        <div className="me-hero-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '18px 28px', zIndex: 1 }}>
          {heroStats.map(s => (
            <div key={s.k} style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.02em', lineHeight: 1, color: s.accent ? 'var(--accent)' : 'var(--ink)' }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.16em', textTransform: 'uppercase', marginTop: 6 }}>{s.k}</div>
            </div>
          ))}
        </div>
        {/* Inline stats for narrow screens */}
        <div className="me-hero-stats-inline" style={{ display: 'none', gap: 20, flexWrap: 'wrap', gridColumn: '1 / -1', zIndex: 1, paddingTop: 8 }}>
          {heroStats.map(s => (
            <div key={s.k} style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1, color: s.accent ? 'var(--accent)' : 'var(--ink)' }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.16em', textTransform: 'uppercase', marginTop: 4 }}>{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DISCOVER — Trending Near You + sidebar ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontFamily: 'var(--f-d)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Trending Near You</h3>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>This week</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {trendingArtists.length > 0
              ? trendingArtists.map((a, i) => <TrendingCard key={a.id} artist={a} idx={i} />)
              : <div style={{ gridColumn: '1/-1', padding: '32px 0', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>No trending artists yet — be the first to HYPE someone.</div>
            }
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Hype activity bars */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 12 }}>Hype activity near you</div>
            {[
              { label: 'Brooklyn, NY', pct: 85, count: '4.2k' },
              { label: 'Chicago, IL',  pct: 62, count: '3.1k' },
              { label: 'Austin, TX',   pct: 41, count: '2.0k' },
              { label: 'Los Angeles',  pct: 30, count: '1.5k' },
              { label: 'Atlanta, GA',  pct: 18, count: '900'  },
            ].map(r => (
              <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 28px', gap: 6, alignItems: 'center', marginBottom: 7 }}>
                <div style={{ fontFamily: 'var(--f-m)', color: 'var(--ink-2)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.pct}%`, background: '#22e5d4', borderRadius: 2 }} />
                </div>
                <div style={{ fontFamily: 'var(--f-m)', color: 'var(--ink-3)', fontSize: 10, textAlign: 'right' }}>{r.count}</div>
              </div>
            ))}
          </div>

          {/* Recent Hypers */}
          <RecentHypers profileId={data.profileId} />
        </div>
      </div>

      {/* Section divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--line-2) 30%, var(--line-2) 70%, transparent)', marginBottom: 28 }} />

      {/* Stat tiles — 4-col + streak card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 14, marginBottom: 20, alignItems: 'stretch' }}>
        {[
          { k: 'Weekly Listens', v: '2,284', d: <><span style={{ color: '#22e5d4' }}>↑ 18%</span> vs last week</> },
          { k: 'Seed Save Rate', v: '26%', d: '88 saves on Sundown' },
          { k: 'Next Payout', v: '$2,460', d: 'releases Jun 24' },
          { k: 'Next Show', v: 'Jun 18', d: 'Empty Bottle · 9PM' },
        ].map(s => (
          <div key={s.k} style={{ padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{s.k}</div>
            <div style={{ fontFamily: 'var(--f-d)', fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1, marginTop: 6 }}>{s.v}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>{s.d}</div>
          </div>
        ))}
        {/* Hype Streak card */}
        {streakData !== null && (() => {
          const s = streakData.streak;
          const emoji = s >= 30 ? '⚡' : '🔥';
          const glowBox = s >= 30
            ? '0 0 0 2px #b983ff'
            : s >= 7 ? '0 0 0 2px #f5d060' : undefined;
          return (
            <div style={{
              padding: '14px 18px',
              border: '1px solid rgba(255,80,41,.25)',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(255,80,41,.15), rgba(255,184,74,.08))',
              boxShadow: glowBox,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minWidth: 110, textAlign: 'center',
            }}>
              {s === 0 ? (
                <>
                  <div style={{ fontSize: 28, lineHeight: 1 }}>🔥</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 8, maxWidth: 120, lineHeight: 1.4 }}>Start your streak — hype something today</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, lineHeight: 1 }}>{emoji}</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--ink)', marginTop: 4 }}>{s}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 4 }}>day streak</div>
                  {streakData.daysActive > s && (
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{streakData.daysActive} days active</div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* See Your Page button */}
      {(() => {
        const slug = data.pageEditor?.slug;
        const type = data.pageEditor?.type;
        const href = slug
          ? (type === 'ARTIST' ? `/artists/${slug}` : type === 'VENUE' ? `/venues/${slug}` : `/fans/${slug}`)
          : '/home';
        return (
          <div style={{ marginBottom: 14 }}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid rgba(255,80,41,.4)',
                background: 'rgba(255,80,41,.06)',
                color: '#ff5029',
                fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '.06em',
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              See Your Page →
            </a>
          </div>
        );
      })()}

      {/* Referral link */}
      {referral && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
          border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)',
          marginBottom: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>
              Your referral link · {referral.count} signup{referral.count !== 1 ? 's' : ''}
            </div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {referral.link}
            </div>
          </div>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(referral.link).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            style={{
              padding: '8px 14px', borderRadius: 7, border: copied ? '1px solid rgba(34,229,212,.4)' : '1px solid var(--line-2)',
              fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer',
              background: copied ? 'rgba(34,229,212,.08)' : 'var(--bg-3)',
              color: copied ? '#22e5d4' : 'var(--ink-2)', transition: 'all .2s', flexShrink: 0,
            }}
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, textAlign: 'right', maxWidth: 100, lineHeight: 1.4 }}>
            Earn 10% of each ticket sale
          </div>
        </div>
      )}

      {/* Artist Anniversary Card */}
      {!anniversaryDismissed && data.lifeStats && data.lifeStats.totalHype > 0 && (
        <div style={{
          position: 'relative',
          padding: '16px 20px',
          marginBottom: 14,
          borderRadius: 14,
          border: '1px solid rgba(255,80,41,.2)',
          background: 'linear-gradient(135deg, rgba(255,80,41,.12), rgba(185,131,255,.08))',
        }}>
          <button
            onClick={() => setAnniversaryDismissed(true)}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 4 }}
            aria-label="Dismiss"
          >✕</button>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-.01em' }}>
            🎂 1 year on iHYPE
          </div>
          <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {data.lifeStats.totalHype.toLocaleString()} hypes, {data.lifeStats.eventsAttended} events attended, {data.lifeStats.songsPlayed.toLocaleString()} songs played. Thanks for being part of the scene.
          </div>
        </div>
      )}

      {/* Two-col: Top 5 + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 14 }}>
        <Panel title="Top 5 — this week" link="Curated · updates Sundays">
          <div style={{ padding: '4px 0' }}>
            {data.tracks.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px', gap: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 32 }}>🎵</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>No tracks yet</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>Upload a song or HYPE an artist to build your listening history.</div>
              </div>
            )}
            {data.tracks.slice(0, 5).map((t, i) => (
              <button key={t.id} onClick={() => onPickTrack(i)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                borderBottom: '1px solid var(--line)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                borderLeft: i === currentIdx ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
                <span style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i === currentIdx ? (
                    <div style={{ width: 20, display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                      {[0,1,2].map(b => (
                        <span key={b} style={{
                          flex: 1, background: 'var(--accent)', borderRadius: 1,
                          animation: `eq ${0.6 + b * 0.15}s ease-in-out infinite alternate`,
                          height: '100%',
                        }} />
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 13, color: 'var(--ink-3)', width: 20 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  )}
                </span>
                <div style={{ width: 32, height: 32, borderRadius: 5, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0, borderBottom: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: i === currentIdx ? 'var(--accent)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '.04em' }}>{t.artistName} · {t.album}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleHype(t.id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 13, color: hypedIds.has(t.id) ? '#ff3e9a' : 'var(--ink-3)', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <IcHeart s={10} c={hypedIds.has(t.id) ? '#ff3e9a' : 'var(--ink-3)'} /> {t.hypeCount + (hypedIds.has(t.id) ? 1 : 0)}
                </button>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{t.duration}</div>
                <button
                  aria-label="Share track"
                  onClick={async e => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/artists/${t.artistName.toLowerCase().replace(/\s+/g, '-')}`;
                    if (navigator.share) {
                      try { await navigator.share({ title: t.title, text: `${t.title} by ${t.artistName}`, url }); } catch {}
                    } else {
                      await navigator.clipboard.writeText(url).catch(() => {});
                    }
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: '4px 8px', display: 'flex', alignItems: 'center', opacity: 0.6 }}
                  title="Share"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Recent activity" link="Mark read">
          <div style={{ padding: '4px 0' }}>
            {data.activity.slice(0, 5).map((a, i) => {
              const dotColor: Record<string, string> = { hype: '#ff3e9a', show: '#22e5d4', radio: '#b983ff', payout: '#ffb84a' };
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor[a.kind] || 'var(--ink-3)', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink)' }}>{a.text}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>{a.time}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* HYPEd tracks */}
      <Panel title="HYPEd this week" link="Open seeds →" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, padding: '14px 16px' }}>
          {data.tracks.slice(0, 6).map((t, i) => (
            <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />
          ))}
        </div>
      </Panel>

      {/* Ticket Stubs */}
      <Panel title="🎟️ Your Ticket Stubs" style={{ marginBottom: 14 }}>
        {data.tickets.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 36 }}>🎟️</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>No tickets yet</div>
            <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-3)', maxWidth: '28ch', lineHeight: 1.5 }}>Buy a ticket to an upcoming show and it'll appear here as a digital stub.</div>
            <a href="/shows" style={{ marginTop: 4, padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #ff3e9a)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Browse shows</a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, padding: '14px 16px' }}>
            {data.tickets.map((tk, i) => (
              <TicketStub key={tk.id} ticket={tk} accentColor={STUB_ACCENT_PALETTE[i % STUB_ACCENT_PALETTE.length]} />
            ))}
          </div>
        )}
      </Panel>

    </div>
  );
}
