'use client';

import React, { useState, useEffect } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShellV2';
import type { WbTicket, WbTrendingProfile } from '@/types/workbench';
import { IcHeart } from './icons';
import { Panel, TrackCard } from './primitives';
import { PageActions } from './PageActions';
import { SplitBar } from '@/components/SplitBar';

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
  const [followed, setFollowed] = useState(false);
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
        <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', padding: '2px 7px', borderRadius: 99, color: '#fff', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {(artist as WbTrendingProfile & { verified?: boolean }).verified && (
            <span title="Verified" style={{ color: '#22e5d4', fontWeight: 700 }}>✓</span>
          )}
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
          <div style={{ display: 'flex', gap: 6 }}>
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
            <button
              onClick={() => {
                if (followed) return;
                setFollowed(true);
                fetch('/api/follow', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ profileId: artist.id }),
                }).catch(() => {});
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: 'var(--f-b)',
                border: followed ? '2px solid rgba(34,229,212,.2)' : '2px solid rgba(34,229,212,.5)',
                background: 'rgba(34,229,212,.1)',
                color: followed ? 'rgba(34,229,212,.5)' : '#22e5d4', cursor: 'pointer', minHeight: 'unset',
              }}
            >
              {followed ? 'Following' : 'Follow'}
            </button>
          </div>
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
  const [referral, setReferral] = useState<{ link: string; count: number; artistLink?: string | null; venueLink?: string | null; djLink?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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
      .then(d => { if (d?.referralLink) setReferral({ link: d.referralLink, count: d.referralCount ?? 0, artistLink: d.artistLink ?? null, venueLink: d.venueLink ?? null, djLink: d.djLink ?? null }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/hype-streak')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStreakData({ streak: d.streak ?? 0, daysActive: d.daysActive ?? 0 }); })
      .catch(() => {});
  }, []);

  const totalHypeReceived = data.lifeStats?.totalHype ?? 0;
  const totalHypeGiven = data.lifeStats?.totalHypeGiven ?? 0;
  const level = Math.max(1, Math.min(99, Math.floor(Math.log2(totalHypeReceived + 2))));
  const heroStats = [
    { v: totalHypeReceived.toLocaleString(), k: 'HYPE Received', accent: true },
    { v: totalHypeGiven.toLocaleString(), k: 'HYPE Given', accent: false },
    { v: String(data.lifeStats?.eventsAttended ?? 0), k: 'Shows Attended', accent: false },
    { v: String(data.lifeStats?.songsPlayed ?? 0), k: 'Songs Played', accent: false },
    { v: String(data.followerCount ?? 0), k: 'Followers', accent: false },
  ];

  const trendingArtists = (data.trending ?? []).slice(0, 3);

  return (
    <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>

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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 99, background: 'rgba(255,184,74,.12)', border: '1px solid rgba(255,184,74,.28)', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: '#ffb84a' }}>⚡ LEVEL {level}</span>
          </div>
          {(data.badges?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {data.badges!.map(b => (
                <span key={b.type} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: 'rgba(185,131,255,.12)', border: '1px solid rgba(185,131,255,.28)', fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#b983ff' }}>
                  🏅 {b.type.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 46, letterSpacing: '-.03em', lineHeight: .95, margin: 0, color: 'var(--ink)' }}>{data.userName}</h1>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.08em' }}>
            {data.city ? `${data.city} · ` : ''}{data.joinedAt ? `Joined ${new Date(data.joinedAt).toLocaleDateString('en-US', { month: 'short' })} '${String(new Date(data.joinedAt).getFullYear()).slice(-2)}` : ''}
          </div>
          {(data.pageEditor?.bio || data.pageEditor?.headline) && (
            <p style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4, maxWidth: '50ch' }}>
              {data.pageEditor?.bio || data.pageEditor?.headline}
            </p>
          )}
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

      {/* ── Hype currency explainer ─────────────────────────────── */}
      {(() => {
        const hypesGiven = data.stats?.hypesGiven ?? 0;
        const WEEKLY_ALLOTMENT = 10;
        const hypesLeft = Math.max(0, WEEKLY_ALLOTMENT - hypesGiven);
        const usedPct = Math.min(100, (hypesGiven / WEEKLY_ALLOTMENT) * 100);
        return (
          <div style={{
            marginBottom: 24, padding: '18px 22px', borderRadius: 14,
            border: '1px solid rgba(255,80,41,.2)',
            background: 'linear-gradient(135deg, rgba(255,80,41,.08), rgba(255,184,74,.05))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="#ff5029" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--ink)', letterSpacing: '-.02em' }}>
                You have {hypesLeft} hype{hypesLeft !== 1 ? 's' : ''} this week
              </span>
            </div>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.6, maxWidth: '60ch' }}>
              Hype is scarce on purpose — it&apos;s a real signal, not a like. Spend it on artists you believe in.
            </p>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Used {hypesGiven} / {WEEKLY_ALLOTMENT}</span>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: hypesLeft > 0 ? '#22e5d4' : '#ff5029' }}>{hypesLeft} remaining</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${usedPct}%`, background: usedPct >= 100 ? '#ff5029' : 'linear-gradient(90deg, #ff5029, #ffb84a)', borderRadius: 3, transition: 'width .5s ease-out' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
              {[
                { icon: '🎟️', text: 'Early ticket access' },
                { icon: '💸', text: 'Referral earnings (10% promoter cut)' },
                { icon: '⚡', text: 'Fan presale windows' },
              ].map(p => (
                <span key={p.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)' }}>
                  {p.icon} {p.text}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

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
          {(() => {
            const byCity: Record<string, number> = {};
            for (const a of (data.trending ?? [])) {
              if (!a.city) continue;
              byCity[a.city] = (byCity[a.city] ?? 0) + a.hypeCount;
            }
            const rows = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const max = rows[0]?.[1] ?? 1;
            if (rows.length === 0) return null;
            return (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 12 }}>Hype activity by city</div>
                {rows.map(([city, count]) => (
                  <div key={city} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 36px', gap: 6, alignItems: 'center', marginBottom: 7 }}>
                    <div style={{ fontFamily: 'var(--f-m)', color: 'var(--ink-2)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city}</div>
                    <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(count / max * 100)}%`, background: '#22e5d4', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontFamily: 'var(--f-m)', color: 'var(--ink-3)', fontSize: 10, textAlign: 'right' }}>{count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Recent Hypers */}
          <RecentHypers profileId={data.profileId} />
        </div>
      </div>

      {/* Profile completion progress */}
      {data.profileCompletion && data.profileCompletion.percent < 100 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', marginBottom: 16,
          border: '1px solid rgba(255,184,74,.25)',
          borderRadius: 12, background: 'rgba(255,184,74,.06)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ffb84a', fontWeight: 600, letterSpacing: '.08em' }}>
                Profile {data.profileCompletion.percent}% complete
              </span>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>
                {data.profileCompletion.missing.length > 0 ? `Add: ${data.profileCompletion.missing.slice(0, 2).join(', ')}` : ''}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${data.profileCompletion.percent}%`, background: 'linear-gradient(90deg, #ffb84a, #ff5029)', borderRadius: 3, transition: 'width .6s ease-out' }} />
            </div>
          </div>
        </div>
      )}

      {/* Upcoming shows near you */}
      {data.shows.filter(s => s.status !== 'ENDED').length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Shows Near You</h3>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}>See all →</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {data.shows.filter(s => s.status !== 'ENDED').slice(0, 6).map((show) => {
              const statusColor: Record<string, string> = { TONIGHT: '#ff3e9a', 'THIS WEEK': '#ffb84a', 'NEAR SOLD': '#ff5029', UPCOMING: '#22e5d4' };
              const color = statusColor[show.status] ?? '#22e5d4';
              return (
                <div key={show.id} style={{
                  flexShrink: 0, width: 180,
                  padding: '12px 14px', borderRadius: 12,
                  border: `1px solid ${color}33`,
                  background: `${color}08`,
                }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 5 }}>{show.status}</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.name}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.venue}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{show.date} · ${show.price}</div>
                  <div style={{ marginTop: 8 }}><SplitBar total={show.price} compact height={5} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--line-2) 30%, var(--line-2) 70%, transparent)', marginBottom: 28 }} />

      {/* Because you hyped — recommendation row */}
      {data.tracks.length > 0 && data.trending && data.trending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <h3 style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                Because you hyped {data.tracks[0].artistName}
              </h3>
              <p style={{ fontFamily: 'var(--f-b)', fontSize: 12, color: 'var(--ink-3)', margin: '3px 0 0' }}>Artists you might love</p>
            </div>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>Based on your taste</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {data.trending.slice(0, 5).map((a, i) => (
              <a key={a.id} href={`/artists/${a.slug}`} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, width: 148, textDecoration: 'none' }}>
                <div style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: '1px solid var(--line-2)', background: 'var(--bg-2)',
                }}>
                  <div style={{
                    height: 80,
                    background: a.avatarImage ? `url(${a.avatarImage}) center/cover` : COVER_GRADIENTS[i % COVER_GRADIENTS.length],
                  }} />
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{a.genre || a.city}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#ff5029', marginTop: 4 }}>♥ {a.hypeCount.toLocaleString()}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Stat tiles — 4-col + streak card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 14, marginBottom: 20, alignItems: 'stretch' }}>
        {(() => {
          const nextShow = data.shows.find(s => s.status !== 'ENDED');
          const pendingStat = data.stats.find(s => s.label === 'PAYOUT PENDING');
          return [
            { k: 'Weekly Listens', v: (data.weeklyListens ?? 0).toLocaleString(), d: 'last 7 days' },
            { k: 'HYPE This Week', v: (data.hypeCount7d ?? 0).toLocaleString(), d: 'on your profiles' },
            { k: 'Payout Pending', v: pendingStat?.value ?? '$0.00', d: pendingStat?.delta ?? '' },
            { k: 'Next Show', v: nextShow ? nextShow.date.split(',')[0] : '—', d: nextShow ? `${nextShow.name} · ${nextShow.time}` : 'No upcoming shows' },
          ];
        })().map(s => (
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
                  {s >= 2 && (
                    <a
                      href="#seeds"
                      onClick={e => { e.preventDefault(); (window as Window & { __ihypeNav?: (v: string) => void }).__ihypeNav?.('seeds'); }}
                      style={{ display: 'inline-block', marginTop: 8, padding: '5px 10px', borderRadius: 6, background: 'rgba(255,80,41,.18)', color: '#ff5029', fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textDecoration: 'none', cursor: 'pointer' }}
                    >
                      Keep it going →
                    </a>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* View / Share your public page (all profile types incl. fans) */}
      <PageActions
        type={data.pageEditor?.type}
        slug={data.pageEditor?.slug}
        title={data.pageEditor?.name || data.userName}
        style={{ marginBottom: 14 }}
      />

      {/* Referral earnings stats */}
      {data.referralStats && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 10 }}>
          {[
            { k: 'Clicks',  v: String(data.referralStats.clicks),  c: 'var(--ink-2)' },
            { k: 'Joined',  v: String(data.referralStats.buyers),  c: 'var(--ink-2)' },
            { k: 'Earned',  v: `$${(data.referralStats.payoutCents / 100).toFixed(0)}`, c: '#ffb84a' },
          ].map(s => (
            <div key={s.k} style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: s.c }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 2 }}>{s.k}</div>
            </div>
          ))}
        </div>
      )}

      {/* Referral links */}
      {referral && (() => {
        const copyLink = async (url: string, key: string) => {
          await navigator.clipboard.writeText(url).catch(() => {});
          setCopied(true);
          setCopiedKey(key);
          setTimeout(() => { setCopied(false); setCopiedKey(null); }, 2000);
        };
        const secondaryLinks = [
          referral.artistLink ? { label: 'Artist link', sublabel: 'For promoting artist content', url: referral.artistLink, key: 'artist', color: '#ff5029' } : null,
          referral.venueLink ? { label: 'Venue link', sublabel: 'For promoting venue shows', url: referral.venueLink, key: 'venue', color: '#22e5d4' } : null,
          referral.djLink ? { label: 'DJ link', sublabel: 'For promoting DJ events', url: referral.djLink, key: 'dj', color: '#ff3e9a' } : null,
        ].filter(Boolean) as { label: string; sublabel: string; url: string; key: string; color: string }[];
        return (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Fan / Promoter link */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {secondaryLinks.length > 0 ? 'Fan / Promoter link' : 'Your referral link'} · {referral.count} signup{referral.count !== 1 ? 's' : ''}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {referral.link}
                </div>
              </div>
              <button
                onClick={() => copyLink(referral.link, 'fan')}
                style={{
                  padding: '8px 14px', borderRadius: 7, border: (copied && copiedKey === 'fan') ? '1px solid rgba(34,229,212,.4)' : '1px solid var(--line-2)',
                  fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer',
                  background: (copied && copiedKey === 'fan') ? 'rgba(34,229,212,.08)' : 'var(--bg-3)',
                  color: (copied && copiedKey === 'fan') ? '#22e5d4' : 'var(--ink-2)', transition: 'all .2s', flexShrink: 0,
                }}
              >
                {(copied && copiedKey === 'fan') ? '✓ Copied' : 'Copy link'}
              </button>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, textAlign: 'right', maxWidth: 100, lineHeight: 1.4 }}>
                Earn 10% of each ticket sale
              </div>
            </div>
            {/* Secondary artist / venue / DJ links */}
            {secondaryLinks.map(sl => (
              <div key={sl.key} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                border: `1px solid ${sl.color}33`, borderRadius: 10, background: `${sl.color}08`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: sl.color, textTransform: 'uppercase', marginBottom: 4 }}>
                    {sl.label}
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sl.url}
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{sl.sublabel} · no promoter credit on own shows</div>
                </div>
                <button
                  onClick={() => copyLink(sl.url, sl.key)}
                  style={{
                    padding: '8px 14px', borderRadius: 7, border: (copied && copiedKey === sl.key) ? `1px solid ${sl.color}66` : '1px solid var(--line-2)',
                    fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer',
                    background: (copied && copiedKey === sl.key) ? `${sl.color}18` : 'var(--bg-3)',
                    color: (copied && copiedKey === sl.key) ? sl.color : 'var(--ink-2)', transition: 'all .2s', flexShrink: 0,
                  }}
                >
                  {(copied && copiedKey === sl.key) ? '✓ Copied' : 'Copy link'}
                </button>
              </div>
            ))}
          </div>
        );
      })()}

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
