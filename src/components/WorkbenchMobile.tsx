'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkbenchData, WbTrack, WbShow } from './WorkbenchShellV2';
import { SearchOverlay } from '@/components/workbench/SearchOverlay';
import { ViewErrorBoundary } from '@/components/workbench/ErrorBoundary';
import { ViewArtistPage } from '@/components/workbench/ViewArtistPage';
import { ViewVenuePage } from '@/components/workbench/ViewVenuePage';

// ─── Design tokens (match Workbench Mobile design) ───────────
const T = {
  bg:     '#0a0805',
  bg2:    '#100d09',
  bg3:    '#1a1612',
  bg4:    '#221c16',
  ink:    '#f0ebe5',
  ink2:   '#9e9080',
  ink3:   '#5a5048',
  ink4:   '#3a342e',
  line:   'rgba(255,255,255,.06)',
  line2:  'rgba(255,255,255,.14)',
  accent: '#ff5029',
  pink:   '#ff3e9a',
  teal:   '#22e5d4',
  purple: '#b983ff',
  amber:  '#ffb84a',
  blue:   '#7fb3ff',
  fd: '"Syne",sans-serif',
  fb: '"DM Sans",sans-serif',
  fm: '"JetBrains Mono",monospace',
  fs: '"Instrument Serif",serif',
};

type MobileTab = 'listen' | 'seeds' | 'shows' | 'you';

// ─── Icons ────────────────────────────────────────────────────
const WMIcon = {
  me:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="6" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>,
  seeds:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>,
  radio:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>,
  studio: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h1M8 6v4M11 7v2"/></svg>,
  tick:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 6a1.5 1.5 0 0 0 0 3v3h12V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M9 3v10" strokeDasharray="1.4 1.4"/></svg>,
  search: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>,
  bell:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7a4 4 0 1 1 8 0v3l1.5 2h-11L4 10V7z"/><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/></svg>,
};

// ─── Pill ─────────────────────────────────────────────────────
function WMPill({ children, tone = 'soft', style }: { children: React.ReactNode; tone?: string; style?: React.CSSProperties }) {
  const tones: Record<string, { bg: string; fg: string; bd: string }> = {
    soft:  { bg: T.bg3,                        fg: T.ink2,   bd: T.line2 },
    live:  { bg: 'rgba(255,80,41,.12)',         fg: T.accent, bd: 'rgba(255,80,41,.3)' },
    teal:  { bg: 'rgba(34,229,212,.1)',         fg: T.teal,   bd: 'rgba(34,229,212,.3)' },
    pink:  { bg: 'rgba(255,62,154,.1)',         fg: T.pink,   bd: 'rgba(255,62,154,.3)' },
    amber: { bg: 'rgba(255,184,74,.1)',         fg: T.amber,  bd: 'rgba(255,184,74,.3)' },
  };
  const t = tones[tone] ?? tones.soft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 7px', borderRadius: 99,
      fontFamily: T.fm, fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, ...style,
    }}>{children}</span>
  );
}

// ─── Chip button ─────────────────────────────────────────────
function WMChip({ children, accent = false, style, onClick }: { children: React.ReactNode; accent?: boolean; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 11px', borderRadius: 7, fontFamily: T.fm, fontSize: 12, fontWeight: 600,
      letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer',
      background: accent ? T.ink : 'transparent', color: accent ? T.bg : T.ink2,
      border: accent ? `1px solid ${T.ink}` : `1px solid ${T.line2}`,
      display: 'inline-flex', alignItems: 'center', gap: 6, ...style,
    }}>{children}</button>
  );
}

// ─── View header ──────────────────────────────────────────────
function WMViewHead({ eyebrow, title, italic, sub, actions }: {
  eyebrow: string; title: string; italic?: string; sub?: string; actions?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
      <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</div>
      <h1 style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1, fontSize: 28, margin: 0 }}>
        {title}{italic && <em style={{ fontFamily: T.fs, fontStyle: 'italic', fontWeight: 400, color: T.ink2 }}> {italic}</em>}
      </h1>
      {sub && <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 14, color: T.ink2, marginTop: 6, lineHeight: 1.35 }}>{sub}</p>}
      {actions && <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────
function WMCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {children}
    </div>
  );
}

// ─── Skeleton block ───────────────────────────────────────────
function WMSkeleton({ w = '100%', h = 14, r = 6, style }: { w?: string | number; h?: number; r?: number; style?: React.CSSProperties }) {
  return <div className="wm-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// ─── Track bottom sheet ───────────────────────────────────────
function WMTrackSheet({ track, open, onClose }: { track: { title: string; artistName: string; album: string; color: string; hypeCount: number } | null; open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,.6)' }} />}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: T.bg3, borderTop: `1px solid ${T.line2}`,
        borderRadius: '18px 18px 0 0',
        boxShadow: '0 -12px 48px rgba(0,0,0,.7)',
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        padding: '0 0 40px',
      }}>
        {/* drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line2 }} />
        </div>
        {track && (
          <div style={{ padding: '20px 22px 0' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg,${track.color},${track.color}80)`,
                boxShadow: `0 8px 24px ${track.color}55`,
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', color: T.ink, lineHeight: 1.1 }}>{track.title}</div>
                <div style={{ fontFamily: T.fb, fontSize: 14, color: T.ink2, marginTop: 5 }}>{track.artistName}</div>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>{track.album}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'rgba(255,62,154,.12)', border: '1px solid rgba(255,62,154,.3)', color: T.pink, fontFamily: T.fd, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                ♥ Hype · {track.hypeCount.toLocaleString()}
              </button>
              <button style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: T.bg4, border: `1px solid ${T.line2}`, color: T.ink, fontFamily: T.fd, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                + Save
              </button>
            </div>
            {[
              { label: 'View artist profile', href: '#' },
              { label: 'Buy tickets', href: '#' },
              { label: 'Add to playlist', href: '#' },
              { label: 'Share', href: '#' },
            ].map(item => (
              <a key={item.label} href={item.href} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 0', borderBottom: `1px solid ${T.line}`,
                textDecoration: 'none', color: T.ink, fontFamily: T.fb, fontSize: 15,
              }}>
                {item.label}
                <span style={{ color: T.ink3, fontSize: 14 }}>›</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Who Hyped This sheet ─────────────────────────────────────
function WMShowHypersSheet({ showId, onClose }: { showId: string | null; onClose: () => void }) {
  const [hypers, setHypers] = React.useState<{ userId: string; username: string | null; avatarUrl: string | null; isFirst: boolean }[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!showId) return;
    setLoading(true);
    fetch(`/api/hype?showId=${showId}&limit=10`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setHypers(d.hypers ?? []); setTotal(d.total ?? 0); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showId]);

  const open = !!showId;
  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,.6)' }} />}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: T.bg3, borderTop: `1px solid ${T.line2}`,
        borderRadius: '18px 18px 0 0', padding: '0 0 env(safe-area-inset-bottom)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .32s cubic-bezier(.4,0,.2,1)',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15, color: T.ink }}>Who Hyped This · {total.toLocaleString()}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 18px 18px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 24, color: T.ink3, fontFamily: T.fm, fontSize: 13 }}>Loading...</div>}
          {!loading && hypers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: T.ink3, fontFamily: T.fm, fontSize: 13 }}>No hypes yet — be the first!</div>
          )}
          {hypers.map((h, i) => {
            const initials = (h.username ?? 'U').slice(0, 2).toUpperCase();
            return (
              <div key={h.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < hypers.length - 1 ? `1px solid ${T.line}` : 'none' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: h.avatarUrl ? 'transparent' : `linear-gradient(135deg,${T.accent},${T.pink})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {h.avatarUrl
                    ? <img src={h.avatarUrl} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: T.bg }}>{initials}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 14, color: T.ink }}>{h.username ?? 'Fan'}</div>
                </div>
                {h.isFirst && (
                  <span style={{ background: 'rgba(255,184,74,.15)', color: T.amber, borderRadius: 99, padding: '3px 9px', fontFamily: T.fm, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', whiteSpace: 'nowrap' }}>First Hyper ⚡</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Trending city strip ──────────────────────────────────────
function WMTrendingStrip({ city }: { city: string }) {
  const [shows, setShows] = React.useState<{ id: string; title: string; hypeCount: number }[]>([]);

  React.useEffect(() => {
    if (!city) return;
    fetch(`/api/trending-local?city=${encodeURIComponent(city.toLowerCase())}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.shows?.length) setShows(d.shows); })
      .catch(() => {});
  }, [city]);

  if (shows.length === 0) return null;

  return (
    <div style={{ padding: '0 0 6px' }}>
      <div style={{ padding: '0 18px 8px', fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.18em', fontWeight: 700, textTransform: 'uppercase' }}>Trending near you</div>
      <div style={{ display: 'flex', gap: 8, padding: '0 18px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {shows.map(s => (
          <div key={s.id} style={{
            flexShrink: 0, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 99,
            padding: '6px 12px', fontFamily: T.fb, fontSize: 12, color: T.ink, whiteSpace: 'nowrap',
          }}>
            🔥 {s.title}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── I Was There button ───────────────────────────────────────
function IWasThereButton({ showId }: { showId: string }) {
  const [done, setDone] = React.useState(false);
  const [count, setCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/shows/${showId}/attendees`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCount(d.count ?? 0); })
      .catch(() => {});
  }, [showId]);

  const mark = async () => {
    if (done || loading) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/shows/${showId}/attendees`, { method: 'POST' });
      if (r.ok) { setDone(true); setCount(c => (c ?? 0) + 1); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div style={{ fontFamily: T.fm, fontSize: 12, color: T.teal, fontWeight: 600, padding: '6px 0' }}>
        ✓ You were there{count !== null ? ` · ${count} others` : ''}
      </div>
    );
  }

  return (
    <button onClick={mark} disabled={loading} style={{
      padding: '6px 12px', borderRadius: 7, border: `1px solid ${T.line2}`, background: T.bg3,
      color: T.ink, fontFamily: T.fm, fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
      letterSpacing: '.06em', opacity: loading ? .6 : 1,
    }}>
      {loading ? '...' : 'I Was There'}
    </button>
  );
}

// ─── Setlist vote sheet ───────────────────────────────────────
function WMSetlistVoteSheet({ showId, onClose }: { showId: string | null; onClose: () => void }) {
  const [tracks, setTracks] = React.useState<{ mediaId: string; title: string; voteCount: number; userVoted: boolean }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!showId) return;
    setLoading(true);
    fetch(`/api/shows/${showId}/setlist-vote`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tracks) setTracks(d.tracks); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showId]);

  const vote = async (mediaId: string) => {
    if (!showId) return;
    // Optimistic update
    setTracks(prev => prev.map(t => t.mediaId === mediaId
      ? { ...t, userVoted: !t.userVoted, voteCount: t.userVoted ? t.voteCount - 1 : t.voteCount + 1 }
      : t
    ));
    await fetch(`/api/shows/${showId}/setlist-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId }),
    }).catch(() => {});
  };

  const open = !!showId;
  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,.6)' }} />}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: T.bg3, borderTop: `1px solid ${T.line2}`,
        borderRadius: '18px 18px 0 0', padding: '0 0 env(safe-area-inset-bottom)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .32s cubic-bezier(.4,0,.2,1)',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15, color: T.ink }}>Vote for Setlist</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 18px 18px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 24, color: T.ink3, fontFamily: T.fm, fontSize: 13 }}>Loading...</div>}
          {!loading && tracks.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: T.ink3, fontFamily: T.fm, fontSize: 13 }}>No tracks available for voting.</div>
          )}
          {tracks.map((t, i) => (
            <div key={t.mediaId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < tracks.length - 1 ? `1px solid ${T.line}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 14, color: T.ink }}>{t.title}</div>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, marginTop: 3 }}>{t.voteCount} vote{t.voteCount !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => vote(t.mediaId)} style={{
                padding: '6px 14px', borderRadius: 99, border: `1px solid ${t.userVoted ? 'rgba(255,62,154,.5)' : T.line2}`,
                background: t.userVoted ? 'rgba(255,62,154,.12)' : T.bg4,
                color: t.userVoted ? T.pink : T.ink2, fontFamily: T.fm, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                {t.userVoted ? '♥ Voted' : '♡ Vote'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Genre quiz sheet ─────────────────────────────────────────
const GENRE_OPTIONS = ['Electronic', 'Hip-Hop', 'Indie', 'Jazz', 'R&B', 'Pop', 'House', 'Techno', 'Soul', 'Afrobeats'];

function WMGenreQuizSheet({ profileId, onComplete }: { profileId: string; onComplete: () => void }) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const toggle = (g: string) => setSelected(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await fetch('/api/profile/genre', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, genres: selected }),
      });
      onComplete();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 8 }}>Quick setup</div>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 28, letterSpacing: '-.025em', color: T.ink, margin: '0 0 8px' }}>What's your taste?</h1>
        <p style={{ fontFamily: T.fb, fontSize: 14, color: T.ink2, marginBottom: 24, lineHeight: 1.5 }}>Pick genres you love — we'll tune your seeds and radio to match.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
          {GENRE_OPTIONS.map(g => {
            const active = selected.includes(g);
            return (
              <button key={g} onClick={() => toggle(g)} style={{
                padding: '9px 16px', borderRadius: 99, cursor: 'pointer', fontFamily: T.fm, fontSize: 13, fontWeight: 700,
                border: `1px solid ${active ? T.accent : T.line2}`,
                background: active ? 'rgba(255,80,41,.15)' : T.bg2,
                color: active ? T.accent : T.ink2,
                transition: 'all .15s',
              }}>{g}</button>
            );
          })}
        </div>
        <button onClick={save} disabled={saving || selected.length === 0} style={{
          width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
          background: selected.length > 0 ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg3,
          color: selected.length > 0 ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15,
          letterSpacing: '-.01em', cursor: selected.length > 0 ? 'pointer' : 'default',
          opacity: saving ? .6 : 1,
        }}>
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
        {selected.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 12, fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>{selected.length} genre{selected.length !== 1 ? 's' : ''} selected</div>
        )}
      </div>
    </div>
  );
}

// ─── EQ animated bars ─────────────────────────────────────────
const eqCss = `
@keyframes wm-eq1{0%,100%{height:3px}50%{height:10px}}
@keyframes wm-eq2{0%,100%{height:5px}50%{height:8px}}
@keyframes wm-eq3{0%,100%{height:4px}50%{height:11px}}
@keyframes wm-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes wm-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.wm-eq-bar:nth-child(1){animation:wm-eq1 1.1s infinite}
.wm-eq-bar:nth-child(2){animation:wm-eq2 .9s infinite}
.wm-eq-bar:nth-child(3){animation:wm-eq3 1.3s infinite}
.wm-pulse{animation:wm-pulse 1.6s infinite}
.wm-scroll::-webkit-scrollbar{display:none}
.wm-skeleton{background:linear-gradient(90deg,#1a1612 25%,#221c16 50%,#1a1612 75%);background-size:200% 100%;animation:wm-shimmer 1.4s infinite}
*:focus-visible { outline: 2px solid var(--accent, #ff5029); outline-offset: 3px; border-radius: 4px; }
`;

// ─── Top bar ─────────────────────────────────────────────────
function WMTopBar({ tab, onTab, listeningNow, userName, initials, onSearch, notifCount, onFeedback, onNotif, activeProfileTypes }: {
  tab: MobileTab; onTab: (t: MobileTab) => void;
  listeningNow: number; userName: string; initials: string;
  onSearch?: () => void;
  notifCount?: number;
  onFeedback?: () => void;
  onNotif?: () => void;
  activeProfileTypes?: string[];
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchVal, setSearchVal] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const titles: Record<MobileTab, string> = {
    listen: 'listen', seeds: 'seeds', shows: 'shows', you: 'you',
  };
  const navItems: { id: MobileTab; icon: string; label: string; badge?: string }[] = [
    { id: 'listen', icon: '🎵', label: 'Listen' },
    { id: 'seeds',  icon: '🌱', label: 'Seeds' },
    { id: 'shows',  icon: '🎟️', label: 'Shows' },
    { id: 'you',    icon: '👤', label: 'You' },
  ];
  const close = () => setMenuOpen(false);

  const openSearch = () => {
    setMenuOpen(false);
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchVal('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    closeSearch();
    onSearch?.();
  };

  return (
    <>
    <header style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8,
      padding: '10px 18px 12px', background: T.bg2, borderBottom: `1px solid ${T.line}`,
      flexShrink: 0, position: 'relative', zIndex: 20,
    }}>
      {/* Left: logo + current section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg,${T.accent},${T.pink})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fd, fontWeight: 800, fontSize: 12, color: T.bg, letterSpacing: '-.02em', position: 'relative',
        }}>
          iH
          <span style={{ position: 'absolute', top: 4, right: 6, width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 15, letterSpacing: '-.03em', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 1, color: T.ink }}>
            iHYPE<span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: T.accent, transform: 'translateY(-7px)' }} />
          </span>
          <span style={{ display: 'block', fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.18em', marginTop: 2, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titles[tab]}
          </span>
        </span>
      </div>

      {/* Search icon button */}
      <button
        aria-label="Search"
        onClick={openSearch}
        style={{
          width: 44, height: 44, borderRadius: 8,
          background: searchOpen ? T.bg3 : 'transparent',
          border: `1px solid ${searchOpen ? T.line2 : T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background .15s',
          color: T.ink2,
        }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>

      {/* Hamburger button */}
      <button
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        onClick={() => { setSearchOpen(false); setMenuOpen(o => !o); }}
        style={{
          width: 44, height: 44, borderRadius: 8, background: menuOpen ? T.bg3 : 'transparent',
          border: `1px solid ${menuOpen ? T.line2 : T.line}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 5, cursor: 'pointer', padding: 0, position: 'relative', transition: 'background .15s', flexShrink: 0,
        }}>
        <span style={{ display: 'block', width: 16, height: 1.5, background: T.ink, borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'translateY(6.5px) rotate(45deg)' : 'none' }} />
        <span style={{ display: 'block', width: 16, height: 1.5, background: T.ink, borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: 'opacity .15s' }} />
        <span style={{ display: 'block', width: 16, height: 1.5, background: T.ink, borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none' }} />
        {(notifCount ?? 0) > 0 && !menuOpen && (
          <span style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: T.accent, border: `1.5px solid ${T.bg2}` }} />
        )}
      </button>
    </header>

    {/* Slide-down search bar */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 21,
      transform: searchOpen ? 'translateY(66px)' : 'translateY(calc(-100% - 66px))',
      transition: 'transform .22s cubic-bezier(.4,0,.2,1)',
      background: T.bg2, borderBottom: `1px solid ${T.line2}`,
      padding: '10px 14px',
    }}>
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 10, padding: '0 12px' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchInputRef}
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Search artists, shows, tracks…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none', padding: '11px 0',
              fontFamily: T.fb, fontSize: 15, color: T.ink,
            }}
          />
          {searchVal && (
            <button type="button" onClick={() => setSearchVal('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, padding: 0, fontSize: 16, lineHeight: 1 }}>✕</button>
          )}
        </div>
        <button type="button" onClick={closeSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, fontFamily: T.fb, fontSize: 14, padding: '0 4px', whiteSpace: 'nowrap' }}>
          Cancel
        </button>
      </form>
    </div>

    {/* Slide-down nav drawer */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 19,
      transform: menuOpen ? 'translateY(66px)' : 'translateY(calc(-100% - 66px))',
      transition: 'transform .24s cubic-bezier(.4,0,.2,1)',
      background: T.bg3, borderBottom: `1px solid ${T.line2}`,
      boxShadow: '0 16px 48px rgba(0,0,0,.7)',
    }}>
      {/* Nav section */}
      <div style={{ padding: '8px 0' }}>
        <div style={{ padding: '8px 20px 6px', fontFamily: T.fm, fontSize: 11, letterSpacing: '.18em', color: T.ink3, textTransform: 'uppercase' }}>Navigate</div>
        {navItems.map(it => {
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => { onTab(it.id); close(); }} style={{
              width: '100%', padding: '13px 20px', background: active ? `rgba(255,80,41,.07)` : 'transparent',
              border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{it.icon}</span>
              <span style={{ fontFamily: T.fb, fontSize: 15, color: active ? T.accent : T.ink, flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 99, fontFamily: T.fm,
                  background: it.badge === 'LIVE' ? 'rgba(255,80,41,.18)' : T.bg4,
                  color: it.badge === 'LIVE' ? T.accent : T.ink2,
                  border: `1px solid ${it.badge === 'LIVE' ? 'rgba(255,80,41,.4)' : T.line2}`,
                  letterSpacing: '.08em',
                }}>{it.badge}</span>
              )}
              {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.line, margin: '0 20px' }} />

      {/* Actions */}
      <div style={{ padding: '8px 0' }}>
        {[
          { icon: '🔔', label: `Notifications${(notifCount ?? 0) > 0 ? ` · ${notifCount}` : ''}`, action: () => { close(); onNotif?.(); }, accent: (notifCount ?? 0) > 0 },
          { icon: '🔗', label: 'Share my page', action: () => { close(); navigator.share?.({ title: 'iHYPE', url: window.location.href }).catch(() => {}); } },
        ].map(item => (
          <button key={item.label} onClick={item.action} style={{
            width: '100%', padding: '13px 20px', background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ fontFamily: T.fb, fontSize: 15, color: item.accent ? T.accent : T.ink }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.line, margin: '0 20px' }} />

      {/* Help / info */}
      <div style={{ padding: '8px 0' }}>
        <div style={{ padding: '8px 20px 6px', fontFamily: T.fm, fontSize: 11, letterSpacing: '.18em', color: T.ink3, textTransform: 'uppercase' }}>Help</div>
        {([
          { icon: 'ℹ️', label: 'About iHYPE', href: '/about' },
          { icon: '🔍', label: 'Transparency', href: '/transparency' },
        ] as { icon: string; label: string; href: string }[]).map(item => (
          <a key={item.label} href={item.href} onClick={close} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px',
            textDecoration: 'none', width: '100%', boxSizing: 'border-box',
          }}>
            <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ fontFamily: T.fb, fontSize: 15, color: T.ink }}>{item.label}</span>
          </a>
        ))}
        <button onClick={() => { close(); onFeedback?.(); }} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px',
          background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🐛</span>
          <span style={{ fontFamily: T.fb, fontSize: 15, color: T.ink }}>Report a bug</span>
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.line, margin: '0 20px' }} />

      {/* Live stat + user */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${T.pink},${T.accent})`, color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>
          <div>
            <div style={{ fontFamily: T.fb, fontSize: 14, color: T.ink }}>{userName}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>iHYPE member</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>
          <span className="wm-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, boxShadow: `0 0 8px ${T.teal}` }} />
          {listeningNow.toLocaleString()} live
        </div>
      </div>
    </div>

    {/* Backdrop (search or menu) */}
    {(menuOpen || searchOpen) && (
      <div onClick={() => { close(); closeSearch(); }} style={{ position: 'absolute', inset: 0, zIndex: 18, background: 'rgba(0,0,0,.55)' }} />
    )}
    </>
  );
}

// ─── Mini Player ─────────────────────────────────────────────
function WMMiniPlayer({ track, playing, onToggle, progress, onAlbumTap }: {
  track: WbTrack; playing: boolean; onToggle: () => void; progress: number; onAlbumTap?: () => void;
}) {
  return (
    <div style={{
      position: 'relative', padding: '8px 12px', background: T.bg2, borderTop: `1px solid ${T.line2}`,
      display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 10, alignItems: 'center', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${T.accent},${T.pink},transparent)`, opacity: .6 }} />
      <div onClick={onAlbumTap} style={{
        width: 40, height: 40, borderRadius: 7, background: `linear-gradient(135deg,${track.color},${track.color}80)`,
        position: 'relative', overflow: 'hidden', flexShrink: 0, cursor: onAlbumTap ? 'pointer' : 'default',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,.3),transparent 60%)' }} />
        {playing && (
          <div style={{ position: 'absolute', bottom: 5, left: 5, display: 'flex', gap: 2, alignItems: 'flex-end', height: 9 }}>
            {[0, 1, 2].map(i => (
              <span key={i} className="wm-eq-bar" style={{ width: 2, background: '#fff', borderRadius: 99, display: 'block', height: 4 }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, letterSpacing: '-.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{track.title}</div>
        <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, marginTop: 2, letterSpacing: '.04em' }}>{track.artistName} <span style={{ color: T.ink4 }}>·</span> {track.album}</div>
        <div style={{ marginTop: 5, height: 2, borderRadius: 99, background: 'rgba(255,255,255,.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: `linear-gradient(90deg,${T.accent},${T.pink})`, borderRadius: 99 }} />
        </div>
      </div>
      <button aria-label="Hype this track" style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
        border: `1px solid rgba(255,62,154,.3)`, borderRadius: 99, color: T.pink,
        fontFamily: T.fm, fontSize: 12, fontWeight: 600, background: 'rgba(255,62,154,.05)', cursor: 'pointer',
        minHeight: 44, minWidth: 44,
      }}>♥ {track.hypeCount}</button>
      <button onClick={onToggle} aria-label={playing ? "Pause" : "Play"} style={{
        width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', background: T.ink, color: T.bg,
        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        {playing
          ? <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>
          : <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 3v10l10-5z"/></svg>}
      </button>
    </div>
  );
}

// ─── Bottom Tab Bar — 4-tab design (Listen · Seeds · Shows · You) ─
function WMBottomTabs({ tab, onTab }: { tab: MobileTab; onTab: (t: MobileTab) => void }) {
  const items: { id: MobileTab; label: string; icon: (s: number, c: string, filled?: boolean) => React.ReactNode }[] = [
    { id: 'listen', label: 'Listen', icon: (s, c) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M9 18V6l10-2v12" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6" cy="18" r="3" stroke={c} strokeWidth="1.7"/>
        <circle cx="16" cy="16" r="3" stroke={c} strokeWidth="1.7"/>
      </svg>
    )},
    { id: 'seeds', label: 'Seeds', icon: (s, c, filled) => filled
      ? <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/></svg>
      : <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 20s-6.5-4.2-9-8.5C1.4 8.4 3 5.5 6.2 5.5c2 0 3.2 1.2 4.8 3 1.6-1.8 2.8-3 4.8-3 3.2 0 4.8 2.9 3.2 6C18.5 15.8 12 20 12 20z" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/></svg>
    },
    { id: 'shows', label: 'Shows', icon: (s, c) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2.5" stroke={c} strokeWidth="1.7"/>
        <path d="M3 10h18M8 3v4M16 3v4" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'you', label: 'You', icon: (s, c) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.7"/>
        <path d="M4.5 20.5c0-4 3.4-7 7.5-7s7.5 3 7.5 7" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    )},
  ];
  return (
    <nav role="navigation" aria-label="Main navigation" style={{
      display: 'flex', background: 'rgba(10,8,5,.88)',
      backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
      borderTop: `1px solid ${T.line}`, padding: '10px 0 8px',
      gap: 0, flexShrink: 0,
    }}>
      {items.map(it => {
        const on = tab === it.id;
        const c = on ? T.accent : T.ink3;
        return (
          <button key={it.id} aria-label={it.label} onClick={() => { navigator.vibrate?.(8); onTab(it.id); }} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', color: c,
            fontFamily: T.fm, fontSize: 9, fontWeight: 600, letterSpacing: '.08em',
            padding: '0 12px', cursor: 'pointer', textTransform: 'uppercase',
            minHeight: 56, minWidth: 44,
          }}>
            <span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {it.icon(25, c, on && it.id === 'seeds')}
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Album art gradient placeholder ──────────────────────────
function AlbumArt({ c = T.accent, size = 48 }: { c?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size / 6)), background: `linear-gradient(135deg, ${c}, ${c}66 60%, ${T.bg3})`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%)' }} />
    </div>
  );
}

// ─── Referral panel ──────────────────────────────────────────
function ReferralPanel({ data }: { data: WorkbenchData }) {
  const [copied, setCopied] = React.useState(false);
  const link = typeof window !== 'undefined' && data.profileHexId
    ? `${window.location.origin}/invite/${data.profileHexId}`
    : null;
  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  const r = data.referralStats;
  return (
    <div style={{ padding: '14px 18px 0' }}>
      <WMCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Invite & Earn</div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>10% referrer cut</div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          {[
            { k: 'Clicks',  v: String(r?.clicks  ?? 0) },
            { k: 'Joined',  v: String(r?.buyers   ?? 0) },
            { k: 'Earned',  v: `$${((r?.payoutCents ?? 0) / 100).toFixed(0)}`, accent: true },
          ].map(s => (
            <div key={s.k}>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 20, color: s.accent ? T.amber : T.ink }}>{s.v}</div>
              <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 2 }}>{s.k}</div>
            </div>
          ))}
        </div>
        <button onClick={copy} style={{
          width: '100%', padding: '10px 0', borderRadius: 8, cursor: 'pointer', border: 'none',
          background: copied ? 'rgba(34,229,212,.12)' : T.bg3,
          color: copied ? T.teal : T.ink,
          fontFamily: T.fm, fontSize: 13, fontWeight: 700, letterSpacing: '.08em',
          transition: 'background .2s, color .2s',
        }}>
          {copied ? '✓ Copied!' : '🔗 Copy invite link'}
        </button>
        <button
          onClick={async () => {
            const ref = data.profileHexId ?? '';
            const shareText = `I joined iHYPE — the music discovery platform for real fans. Come join me! ihype.org/join?ref=${ref}`;
            const shareUrl = `https://ihype.org/join?ref=${ref}`;
            const nav = typeof navigator !== 'undefined' ? navigator as Navigator & { share?: (d: object) => Promise<void> } : null;
            if (nav && nav.share) {
              await nav.share({ title: 'Join me on iHYPE', text: shareText, url: shareUrl }).catch(() => {});
            } else {
              try { await (navigator as Navigator & { clipboard: { writeText: (s: string) => Promise<void> } }).clipboard.writeText(shareText); } catch { /* ignore */ }
            }
          }}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${T.line2}`, background: 'transparent',
            color: T.ink2, fontFamily: T.fm, fontSize: 13, fontWeight: 700, letterSpacing: '.08em',
          }}
        >
          ↗ Share invite
        </button>
      </WMCard>
    </div>
  );
}

// ─── Screen: Me ──────────────────────────────────────────────
function ScreenMe({ data }: { data: WorkbenchData }) {
  const [deletingAccount, setDeletingAccount] = React.useState(false);

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    if (!window.confirm('Final confirmation: all your data will be permanently deleted.')) return;
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/settings/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch { /* ignore */ } finally {
      setDeletingAccount(false);
    }
  };
  return (
    <>
      {/* Hero portrait card */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg,${T.bg2},${T.bg3})`,
          border: `1px solid ${T.line2}`, borderRadius: 16, padding: 18,
        }}>
          <div style={{ position: 'absolute', top: '-40%', right: '-20%', width: '70%', height: '200%', background: `radial-gradient(ellipse,rgba(255,80,41,.22),transparent 60%)`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', position: 'relative', zIndex: 2 }}>
            <div style={{
              width: 90, height: 90, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg,${T.accent},${T.pink},${T.purple})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 36, color: T.bg, letterSpacing: '-.04em', mixBlendMode: 'overlay', opacity: .85 }}>{data.userInitials}</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
                {data.activeProfileTypes.includes('LISTENER') && <WMPill><span style={{ width: 5, height: 5, borderRadius: '50%', background: T.purple, display: 'inline-block' }} />FAN</WMPill>}
                {data.activeProfileTypes.includes('ARTIST') && <WMPill><span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />ARTIST</WMPill>}
                <WMPill tone="amber">⚡ LV {Math.max(1, Math.floor((data.lifeStats?.totalHype ?? 0) / 100) + 1)}</WMPill>
              </div>
              <h1 style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', lineHeight: .95, fontSize: 30, margin: 0, color: T.ink }}>{data.userName}</h1>
              <p style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, letterSpacing: '.08em', marginTop: 6 }}>@{data.userName.toLowerCase().replace(/\s/g, '.')} · {data.city}</p>
              {(data.uploadStreak ?? 0) > 0 && (
                <span style={{ display: 'inline-block', marginTop: 6, background: 'rgba(245,158,11,.13)', color: '#f59e0b', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                  🔥 {data.uploadStreak}wk streak
                </span>
              )}
            </div>
          </div>
          <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 14, color: T.ink2, marginTop: 14, lineHeight: 1.4, position: 'relative', zIndex: 2 }}>
            "Halflight EP out now. Writing the next thing in a basement on Western Ave. Recommendations open."
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${T.line}` }}>
            {[
              { v: (data.lifeStats?.totalHype ?? 0).toLocaleString(), k: 'Given', accent: true },
              { v: (data.stats.find(s => s.label.toLowerCase().includes('received'))?.value ?? '—'), k: 'Received' },
              { v: String(data.lifeStats?.eventsAttended ?? 0), k: 'Shows' },
              { v: (data.stats.find(s => s.label.toLowerCase().includes('top'))?.value ?? String(data.tracks.length)), k: 'Tracks' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', fontSize: 18, color: s.accent ? T.accent : T.ink }}>{s.v}</div>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 3 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pulse stat tiles — horizontal scroll */}
      <div style={{ padding: '16px 0 6px' }}>
        <div style={{ padding: '0 18px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 13, color: T.ink }}>Pulse</div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>this week</div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 18px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(() => {
            const nextShow = data.shows[0];
            const payout = data.referralStats?.payoutCents ?? data.lifeStats?.totalEarnings ?? 0;
            const listens = data.stats.find(s => s.label.toLowerCase().includes('listen') || s.label.toLowerCase().includes('play'));
            const saves = data.stats.find(s => s.label.toLowerCase().includes('save'));
            return [
              { k: 'Total listens', v: listens?.value ?? (data.lifeStats?.songsPlayed ?? 0).toLocaleString(), d: listens?.delta ?? 'all time', c: T.teal },
              { k: 'Save rate',     v: saves?.value ?? '—',    d: saves?.delta ?? '',          c: T.accent },
              { k: 'Earnings',      v: `$${(payout / 100).toFixed(0)}`, d: 'lifetime',         c: T.amber },
              { k: 'Next show',     v: nextShow ? nextShow.date : '—', d: nextShow ? nextShow.name : 'No shows yet', c: T.pink },
            ];
          })().map((t, i) => (
            <div key={i} style={{ flex: '0 0 142px', background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 13px' }}>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase' }}>{t.k}</div>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.025em', marginTop: 5, color: t.c }}>{t.v}</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, marginTop: 3, letterSpacing: '.04em' }}>{t.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 */}
      <div style={{ padding: '14px 18px 0' }}>
        <WMCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Top 5 — this week</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>Sundays</div>
          </div>
          {data.tracks.slice(0, 5).map((t, i) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '18px 34px 1fr auto', gap: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: T.ink3, textAlign: 'center' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ width: 34, height: 34, borderRadius: 5, background: `linear-gradient(135deg,${t.color},${t.color}80)`, display: 'block' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{t.title}</div>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.04em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artistName} · {t.album}</div>
              </div>
              <span style={{ fontFamily: T.fm, fontSize: 12, color: T.pink, fontWeight: 600, whiteSpace: 'nowrap' }}>♥ {t.hypeCount}</span>
            </div>
          ))}
        </WMCard>
      </div>

      {/* Referral / Invite panel */}
      <ReferralPanel data={data} />

      {/* Activity */}
      <div style={{ padding: '14px 18px 0' }}>
        <WMCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Recent activity</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>24h</div>
          </div>
          {data.activity.length === 0 && (
            <div style={{ padding: '16px 0', textAlign: 'center', fontFamily: T.fb, fontSize: 13, color: T.ink3 }}>
              Start exploring — hype tracks and follow artists to build your history
            </div>
          )}
          {data.activity.slice(0, 5).map((a, i, arr) => {
            const dotColors: Record<string, string> = { hype: T.pink, show: T.teal, radio: T.pink, payout: T.amber };
            const ic: Record<string, string> = { hype: '♥', show: '★', radio: '📻', payout: '$', default: '↗' };
            const c = dotColors[a.kind] ?? T.purple;
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px dashed ${T.line}` }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  background: `${c}22`, color: c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.fm, fontSize: 13, fontWeight: 700,
                }}>{ic[a.kind] ?? '↗'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink, lineHeight: 1.35 }}>{a.text}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2 }}>{a.time}</div>
                </div>
              </div>
            );
          })}
        </WMCard>
      </div>

      {/* Listening history */}
      <ListeningHistorySection />

      {/* Playlists */}
      <PlaylistsSection />

      {/* Ad Campaigns (if advertiser) */}
      <AdCampaignsSection />

      {/* Danger zone */}
      <div style={{ padding: '14px 18px 32px' }}>
        <button
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 9, border: `1px solid rgba(239,68,68,.4)`,
            background: 'rgba(239,68,68,.07)', color: '#ef4444',
            fontFamily: T.fm, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', cursor: 'pointer',
            opacity: deletingAccount ? .6 : 1,
          }}
        >
          {deletingAccount ? 'Deleting account…' : 'Delete account'}
        </button>
      </div>
    </>
  );
}

// ─── Listening History Section ────────────────────────────────
function ListeningHistorySection() {
  const [history, setHistory] = React.useState<{ id: string; title: string; artistName: string; createdAt: string }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/me/listening-history')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.history) setHistory(d.history.slice(0, 10)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && history.length === 0) return null;

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <WMCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Listening history</div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>recent</div>
        </div>
        {!loaded && <WMSkeleton h={48} />}
        {history.map((h, i) => (
          <div key={h.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i === 0 ? 'none' : `1px dashed ${T.line}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 5, background: T.bg3, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 13, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.04em' }}>{h.artistName}</div>
            </div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, whiteSpace: 'nowrap', alignSelf: 'center' }}>
              {new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        ))}
      </WMCard>
    </div>
  );
}

// ─── Playlists Section ────────────────────────────────────────
function PlaylistsSection() {
  const [playlists, setPlaylists] = React.useState<{ id: string; name: string; items: { id: string }[] }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/playlists')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.playlists) setPlaylists(d.playlists); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && playlists.length === 0) return null;

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <WMCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>My playlists</div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>{playlists.length}</div>
        </div>
        {!loaded && <WMSkeleton h={40} />}
        {playlists.map((pl, i) => (
          <a key={pl.id} href={`/playlist/${pl.id}`} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderTop: i === 0 ? 'none' : `1px dashed ${T.line}`,
            textDecoration: 'none', color: T.ink,
          }}>
            <div style={{ fontFamily: T.fb, fontSize: 13, fontWeight: 600 }}>{pl.name}</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>{pl.items.length} tracks ›</div>
          </a>
        ))}
      </WMCard>
    </div>
  );
}

// ─── Ad Campaigns Section ─────────────────────────────────────
function AdCampaignsSection() {
  const [campaigns, setCampaigns] = React.useState<{ id: string; title: string; status: string; impressions: number; clicks: number }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/advertise/campaigns')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.campaigns) setCampaigns(d.campaigns); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && campaigns.length === 0) return null;

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <WMCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Ad campaigns</div>
          <a href="/advertise/dashboard" style={{ fontFamily: T.fm, fontSize: 12, color: T.teal, letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}>Manage →</a>
        </div>
        {!loaded && <WMSkeleton h={40} />}
        {campaigns.slice(0, 3).map((c, i) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i === 0 ? 'none' : `1px dashed ${T.line}` }}>
            <div>
              <div style={{ fontFamily: T.fb, fontSize: 13, fontWeight: 600, color: T.ink }}>{c.title}</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>{c.impressions} impressions · {c.clicks} clicks</div>
            </div>
            <WMPill tone={c.status === 'APPROVED' ? 'teal' : c.status === 'REJECTED' ? 'live' : 'amber'}>{c.status}</WMPill>
          </div>
        ))}
      </WMCard>
    </div>
  );
}

// ─── Screen: Seeds ───────────────────────────────────────────
function ScreenSeeds({ data, onHypersSheet }: { data: WorkbenchData; onHypersSheet?: (showId: string) => void }) {
  const waveform = [30, 55, 80, 42, 90, 70, 48, 88, 62, 35, 78, 55, 92, 40, 68, 82, 48, 30, 62, 88];

  // Deck state
  const [deck, setDeck] = useState(data.tracks);
  const [deckIdx, setDeckIdx] = useState(0);
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [sessionStats, setSessionStats] = useState({ saved: 0, skipped: 0, hyped: 0 });
  const [loadingDeck, setLoadingDeck] = useState(true);

  // Swipe / drag state — use refs for hot-path, state only for render triggers
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [flyOff, setFlyOff] = useState<{ x: number; y: number; rot: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragXRef = useRef(0);
  const dragYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Fetch deck on mount
  useEffect(() => {
    setLoadingDeck(true);
    fetch('/api/discover/seeds')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.seeds?.length) setDeck(d.seeds); })
      .catch(() => {})
      .finally(() => setLoadingDeck(false));
  }, []);

  const handleAction = useCallback((action: 'save' | 'skip' | 'hype', fromDrag = false, dragDx = 0, dragDy = 0) => {
    const front = deck.length > 0 && deckIdx < deck.length ? deck[deckIdx] : undefined;
    if (!front || actionedIds.has(front.id)) return;

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(action === 'hype' ? [10, 30, 10] : 8);
    }

    // Compute fly-off direction
    const flyX = action === 'hype' ? 500 : action === 'skip' ? -500 : fromDrag ? dragDx * 3 : 0;
    const flyY = action === 'save' ? -600 : fromDrag ? dragDy * 2 : 0;
    const rot  = action === 'hype' ? 25 : action === 'skip' ? -25 : dragDx * 0.15;
    setFlyOff({ x: flyX, y: flyY, rot });

    setTimeout(() => {
      setFlyOff(null);
      setActionedIds(prev => new Set([...prev, front.id]));
      setDeckIdx(i => i + 1);
      setSessionStats(prev => ({
        ...prev,
        saved:   action === 'save'  ? prev.saved + 1  : prev.saved,
        skipped: action === 'skip'  ? prev.skipped + 1 : prev.skipped,
        hyped:   action === 'hype'  ? prev.hyped + 1  : prev.hyped,
      }));
      // Load more when near end
      const remaining = deck.length - (deckIdx + 1);
      if (remaining <= 3) {
        fetch('/api/discover/seeds').then(r => r.ok ? r.json() : null).then(d => {
          if (d?.seeds?.length) {
            setDeck(prev => [...prev, ...d.seeds.filter((s: {id:string}) => !actionedIds.has(s.id))]);
          }
        }).catch(() => {});
      }
      fetch(`/api/discover/seeds/${encodeURIComponent(front.id)}/${action}`, { method: 'POST' }).catch(() => {});
    }, 320);
  }, [deck, deckIdx, actionedIds]);

  const front = deck.length > 0 && deckIdx < deck.length ? deck[deckIdx] : undefined;
  const behind = deck.length > 1 && front ? [
    deck[(deckIdx + 2) % deck.length],
    deck[(deckIdx + 1) % deck.length],
  ] : [];

  const xp = sessionStats.saved * 10 + sessionStats.hyped * 5 + sessionStats.skipped * 1;
  const totalReviewed = sessionStats.saved + sessionStats.skipped + sessionStats.hyped;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragXRef.current = 0;
    dragYRef.current = 0;
    setIsPressed(true);
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragXRef.current = dx;
    dragYRef.current = dy;
    if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      setIsDragging(true);
      setIsPressed(false);
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setDragX(dragXRef.current);
      setDragY(dragYRef.current);
    });
  }

  function handlePointerUp() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dx = dragXRef.current;
    const dy = dragYRef.current;
    if (isDragging) {
      if (dx > 100)       handleAction('hype', true, dx, dy);
      else if (dx < -100) handleAction('skip', true, dx, dy);
      else if (dy < -100) handleAction('save', true, dx, dy);
    }
    setIsPressed(false);
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
    dragStart.current = null;
    dragXRef.current = 0;
    dragYRef.current = 0;
  }

  return (
    <>
      <WMViewHead
        eyebrow="DISCOVER · 15–30s · CHICAGO"
        title="Seeds"
        italic="— decide in 15s."
        sub="Hand-cut hooks from new uploads. Save it, hype it, skip it."
        actions={<><WMChip>⚙ Filters</WMChip><WMChip>Local · Chicago ▾</WMChip></>}
      />
      {data.city && <WMTrendingStrip city={data.city} />}

      <div style={{ padding: '0 18px' }}>
        {/* Session stats */}
        <div style={{
          background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 18,
        }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { k: 'Reviewed', v: totalReviewed > 0 ? String(totalReviewed) : '—', c: T.ink },
              { k: 'Saved',    v: sessionStats.saved   > 0 ? `+${sessionStats.saved}`   : '—', c: T.teal },
              { k: 'Hyped',    v: sessionStats.hyped   > 0 ? String(sessionStats.hyped) : '—', c: T.pink },
              { k: 'XP',       v: xp > 0 ? `+${xp}` : '—', c: T.amber },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{s.k}</div>
                <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: s.c, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Card stack */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 3.6', marginBottom: 14 }}>
          {/* Skeleton loading state */}
          {loadingDeck && (
            <div className="wm-skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 18 }} />
          )}
          {/* All-reviewed state */}
          {!loadingDeck && deck.length > 0 && !front && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: T.bg2, border: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 36 }}>✅</div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15, color: T.ink }}>You&#39;re all caught up!</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', textAlign: 'center', maxWidth: 200 }}>You reviewed {totalReviewed} seed{totalReviewed !== 1 ? 's' : ''} this session.</div>
              <button onClick={() => { setLoadingDeck(true); fetch('/api/discover/seeds').then(r => r.ok ? r.json() : null).then(d => { if (d?.seeds?.length) { setDeck(d.seeds); setDeckIdx(0); } }).catch(() => {}).finally(() => setLoadingDeck(false)); }} style={{ marginTop: 4, padding: '7px 20px', borderRadius: 99, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Load more</button>
            </div>
          )}
          {/* Empty state */}
          {!loadingDeck && deck.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: T.bg2, border: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 36 }}>🌱</div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15, color: T.ink }}>No seeds right now</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', textAlign: 'center', maxWidth: 200 }}>Check back soon — new music drops daily.</div>
              <button onClick={() => { setLoadingDeck(true); fetch('/api/discover/seeds').then(r => r.ok ? r.json() : null).then(d => { if (d?.seeds?.length) { setDeck(d.seeds); setDeckIdx(0); } }).catch(() => {}).finally(() => setLoadingDeck(false)); }} style={{ marginTop: 4, padding: '7px 20px', borderRadius: 99, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Refresh</button>
              {(data.activeProfileTypes.includes('ARTIST') || data.activeProfileTypes.includes('DJ')) && (
                <div style={{ marginTop: 8, padding: '12px 16px', borderRadius: 10, background: T.bg3, border: `1px solid ${T.line2}`, textAlign: 'center', maxWidth: 240 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, color: T.ink, marginBottom: 4 }}>Upload a track to get seeded</div>
                  <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink3, lineHeight: 1.4, marginBottom: 10 }}>Your music gets surfaced as a seed when you upload it</div>
                  <a href="/upload" style={{ padding: '7px 18px', borderRadius: 99, background: T.accent, color: T.bg, fontFamily: T.fd, fontWeight: 700, fontSize: 12, textDecoration: 'none', display: 'inline-block' }}>+ Upload track</a>
                </div>
              )}
            </div>
          )}
          {/* behind cards */}
          {!loadingDeck && behind.map((t, i) => (
            <div key={t.id} style={{
              position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden',
              transform: `translateY(${(behind.length - i) * 8}px) scale(${.9 + i * .05})`,
              opacity: .35 + i * .25, zIndex: i,
              background: `linear-gradient(135deg,${t.color},${t.color}80)`,
              boxShadow: '0 12px 32px rgba(0,0,0,.5)',
            }} />
          ))}
          {/* front card */}
          {!loadingDeck && front && (() => {
            // Proportional tint: 0 at 0px drag, full at 100px
            const hypeAlpha = Math.min(Math.max(dragX / 100, 0), 1) * 0.55;
            const skipAlpha = Math.min(Math.max(-dragX / 100, 0), 1) * 0.55;
            const saveAlpha = Math.min(Math.max(-dragY / 100, 0), 1) * 0.55;
            return (
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{
                  position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', zIndex: 5,
                  background: `linear-gradient(150deg,${front.color}ee,${front.color}99)`,
                  boxShadow: isPressed
                    ? `0 8px 24px rgba(0,0,0,.5), 0 0 0 2px ${front.color}88`
                    : '0 20px 48px -8px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06)',
                  transform: flyOff
                    ? `translateX(${flyOff.x}px) translateY(${flyOff.y}px) rotate(${flyOff.rot}deg)`
                    : isDragging
                      ? `translateX(${dragX}px) translateY(${dragY * 0.3}px) rotate(${dragX * 0.06}deg)`
                      : isPressed ? 'scale(0.97)' : 'scale(1)',
                  transition: flyOff
                    ? 'transform .3s cubic-bezier(.4,0,.2,1)'
                    : isDragging ? 'none'
                    : 'transform .15s ease, box-shadow .15s ease',
                  touchAction: 'none',
                  userSelect: 'none',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  willChange: 'transform',
                }}>
                {/* Full-card tint overlays — proportional to drag */}
                {hypeAlpha > 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(34,200,80,${hypeAlpha})`, pointerEvents: 'none', borderRadius: 18 }} />}
                {skipAlpha > 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(255,60,60,${skipAlpha})`, pointerEvents: 'none', borderRadius: 18 }} />}
                {saveAlpha > 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(34,229,212,${saveAlpha})`, pointerEvents: 'none', borderRadius: 18 }} />}
                {/* Action labels — appear past halfway */}
                {dragX > 50 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9, color: '#fff', fontFamily: T.fd, fontWeight: 900, fontSize: 32, letterSpacing: '-.02em', opacity: Math.min((dragX - 50) / 50, 1), pointerEvents: 'none', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>HYPE ♥</div>}
                {dragX < -50 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9, color: '#fff', fontFamily: T.fd, fontWeight: 900, fontSize: 32, letterSpacing: '-.02em', opacity: Math.min((-dragX - 50) / 50, 1), pointerEvents: 'none', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>SKIP ✕</div>}
                {dragY < -50 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9, color: '#fff', fontFamily: T.fd, fontWeight: 900, fontSize: 32, letterSpacing: '-.02em', opacity: Math.min((-dragY - 50) / 50, 1), pointerEvents: 'none', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>SAVE ↑</div>}
                {/* texture */}
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 8px,transparent 8px 16px)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 20%,rgba(255,255,255,.18),transparent 55%)' }} />
                {/* strong bottom gradient so text is always readable */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 35%,rgba(0,0,0,.92) 100%)', zIndex: 2 }} />
                {/* tags */}
                <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', zIndex: 3 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(0,0,0,.6)', fontFamily: T.fm, fontSize: 11, letterSpacing: '.12em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />SEED · 22s
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(255,255,255,.15)', fontFamily: T.fm, fontSize: 11, letterSpacing: '.12em', fontWeight: 700, color: '#fff' }}>CHICAGO</span>
                </div>
                {/* waveform */}
                <div style={{ position: 'absolute', bottom: 100, left: 16, right: 16, height: 28, display: 'flex', alignItems: 'flex-end', gap: 2, zIndex: 3 }}>
                  {waveform.map((h, i) => (
                    <span key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(255,255,255,.5)', borderRadius: 99, display: 'block' }} />
                  ))}
                </div>
                {/* track info */}
                <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, zIndex: 3, color: '#fff' }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,.5)' }}>{front.title}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 11, color: 'rgba(255,255,255,.75)', letterSpacing: '.1em', marginTop: 3, textTransform: 'uppercase' }}>{front.artistName} · {front.album}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: T.fm, fontSize: 11, letterSpacing: '.06em', color: 'rgba(255,255,255,.6)' }}>
                    <span>♥ {front.hypeCount} hype</span>
                    <span>{deck.length - deckIdx} left</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Swipe controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
          {[
            { c: '#ff6b5a', bd: 'rgba(255,107,90,.4)', sz: 46, label: '✕', action: 'skip' },
            { c: T.ink2,    bd: T.line2,               sz: 42, label: '↺', action: 'replay' },
            { c: T.teal,    bd: 'rgba(34,229,212,.4)', sz: 60, label: '▶', action: 'save' },
            { c: T.pink,    bd: 'rgba(255,62,154,.4)', sz: 46, label: '♥', action: 'hype' },
          ].map((b, i) => (
            <button key={i} onClick={() => {
              if (b.action === 'skip')   void handleAction('skip');
              else if (b.action === 'save')  void handleAction('save');
              else if (b.action === 'hype')  void handleAction('hype');
              // replay: no-op
            }} style={{
              width: b.sz, height: b.sz, borderRadius: '50%',
              background: T.bg2, border: `1px solid ${b.bd}`, color: b.c,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontFamily: T.fm, fontSize: b.sz * 0.32, fontWeight: 700,
            }}>{b.label}</button>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 18 }}>
          swipe · ↑ save · → hype
        </div>

        {/* Daily quest */}
        <WMCard style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, letterSpacing: '-.01em', color: T.ink }}>Daily Quest · Save 5 seeds</div>
            <WMPill tone="amber">+60 XP</WMPill>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i < sessionStats.saved ? T.accent : T.bg3, display: 'block' }} />
            ))}
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em' }}>{sessionStats.saved} / 5 · earn Seed Curator badge</div>
        </WMCard>

        {/* Up next */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>Up next</div>
          <WMCard style={{ gap: 8 }}>
            {deck.slice(deckIdx + 1, deckIdx + 4).map((t, i) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'center', opacity: i === 2 ? .5 : 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 6, background: `linear-gradient(135deg,${t.color},${t.color}80)` }} />
                <div>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12, color: T.ink }}>{t.title}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2 }}>{t.artistName}</div>
                </div>
              </div>
            ))}
          </WMCard>
        </div>

        {/* Why this seed */}
        <WMCard style={{ marginBottom: 14, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase' }}>Why this seed?</div>
          <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
            You hyped <span style={{ color: T.accent, fontWeight: 600 }}>3 tracks</span> from this artist this month — promoter test pressing from their unreleased EP.
          </div>
        </WMCard>

        {/* Collab board */}
        <CollabBoardSection />
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}

// ─── Screen: Radio ───────────────────────────────────────────
function ScreenRadio({ data, onSetlistSheet, onHypersSheet, onSeedsTab }: { data: WorkbenchData; onSetlistSheet?: (showId: string) => void; onHypersSheet?: (showId: string) => void; onSeedsTab?: () => void }) {
  const shows = data.radioShows;
  const live = shows.find(s => s.live);
  const rest = shows.filter(s => !s.live);

  return (
    <>
      <WMViewHead
        eyebrow={`LIVE NOW · ${shows.filter(s => s.live).length || 1} SHOWS ON AIR`}
        title="Radio"
        sub="Live and prerecorded shows from DJs and artists — every spin pays the source."
        actions={<><WMChip>⌲ Schedule</WMChip><WMChip>+ New show</WMChip></>}
      />
      {data.city && <WMTrendingStrip city={data.city} />}

      <div style={{ padding: '0 18px' }}>
        {/* Live hero */}
        {live && (
          <div style={{
            background: `linear-gradient(120deg,rgba(255,62,154,.22),rgba(255,80,41,.12),transparent)`,
            border: `1px solid ${T.line2}`, borderRadius: 14, padding: 16, position: 'relative', overflow: 'hidden', marginBottom: 20,
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: `repeating-linear-gradient(45deg,rgba(255,62,154,.06) 0 2px,transparent 2px 14px)`, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{
                width: 88, height: 88, borderRadius: 11, background: `linear-gradient(135deg,${live.color},${live.color}80)`,
                position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,.3),transparent 60%)' }} />
                <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 36, color: T.bg, letterSpacing: '-.04em', zIndex: 2, mixBlendMode: 'overlay', opacity: .9 }}>01</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 12, color: T.accent, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>
                  <span className="wm-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, boxShadow: `0 0 12px ${T.accent}`, display: 'inline-block' }} />
                  ON AIR · {live.listeners.toLocaleString()}
                </div>
                <h2 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.025em', margin: '5px 0 0', color: T.ink }}>{live.name}</h2>
                <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 13, color: T.ink2, margin: '3px 0 0' }}>with {live.host}</p>
              </div>
            </div>
            <div style={{
              marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 7, fontFamily: T.fm, fontSize: 13, color: T.ink,
            }}>
              <span style={{ fontStyle: 'normal', color: T.ink3, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>NOW</span>
              <span style={{ flex: 1 }}>{data.tracks[0]?.title} — {data.tracks[0]?.artistName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>Next: <b style={{ color: T.ink }}>{data.tracks[1]?.title}</b></span>
              <button style={{
                padding: '10px 18px', borderRadius: 99, background: T.ink, color: T.bg,
                fontFamily: T.fm, fontWeight: 700, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer',
              }}>▶ Tune In</button>
            </div>
          </div>
        )}

        {/* Shows list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 16, color: T.ink, margin: 0 }}>All shows</h2>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>by <span style={{ color: T.ink }}>next on air</span></div>
        </div>
        {!live && shows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14 }}>
            No live shows right now —{' '}
            <button onClick={onSeedsTab} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontFamily: T.fb, fontSize: 14, padding: 0, textDecoration: 'underline' }}>
              explore Seeds to discover new music ↗
            </button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {rest.slice(0, 4).map((r, i) => (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12,
              background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 11, padding: 12, alignItems: 'flex-start',
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: `linear-gradient(135deg,${r.color},${r.color}80)` }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <h3 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, letterSpacing: '-.025em', margin: 0, color: T.ink }}>{r.name}</h3>
                    <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>with {r.host}</div>
                  </div>
                  <WMPill>{i === 0 ? 'PRERECORDED' : i === 2 ? 'YOURS' : 'WEEKLY'}</WMPill>
                </div>
                <p style={{ fontFamily: T.fb, fontSize: 13, color: T.ink2, marginTop: 8, lineHeight: 1.4 }}>{r.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.line}` }}>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink, fontWeight: 600 }}>{r.time}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!r.live && onSetlistSheet && (
                      <button onClick={() => onSetlistSheet(r.id)} style={{
                        background: 'none', border: `1px solid ${T.line2}`, borderRadius: 99, padding: '3px 9px',
                        color: T.ink3, fontFamily: T.fm, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>Vote setlist →</button>
                    )}
                    <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{r.next}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Screen: Studio ──────────────────────────────────────────
function ScreenStudio({ data }: { data: WorkbenchData }) {
  const [disputeSheetShowId, setDisputeSheetShowId] = React.useState<string | null>(null);
  const [disputeReason, setDisputeReason] = React.useState('');
  const [disputeAmount, setDisputeAmount] = React.useState('');
  const [disputeState, setDisputeState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [embedCopied, setEmbedCopied] = React.useState(false);
  const [fanMailOpen, setFanMailOpen] = React.useState(false);
  const [fanMailSubject, setFanMailSubject] = React.useState('');
  const [fanMailContent, setFanMailContent] = React.useState('');
  const [fanMailState, setFanMailState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [scheduleDate, setScheduleDate] = React.useState('');

  const handleCopyEmbed = () => {
    const profileHexId = data.profileHexId ?? '';
    if (!profileHexId) return;
    const snippet = `<iframe src="https://ihype.org/embed/${profileHexId}" width="320" height="80" frameborder="0" scrolling="no" allow="autoplay" style="border-radius:12px;overflow:hidden"></iframe>`;
    navigator.clipboard.writeText(snippet).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2500);
    }).catch(() => {});
  };

  const handleFanMail = async () => {
    const profileId = data.profileId ?? '';
    if (!profileId || !fanMailSubject.trim() || !fanMailContent.trim()) return;
    setFanMailState('loading');
    try {
      const res = await fetch(`/api/profile/${profileId}/fan-mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: fanMailSubject, content: fanMailContent }),
      });
      setFanMailState(res.ok ? 'done' : 'error');
      if (res.ok) setTimeout(() => { setFanMailOpen(false); setFanMailState('idle'); setFanMailSubject(''); setFanMailContent(''); }, 2000);
    } catch { setFanMailState('error'); }
  };

  const handleDispute = async (showId: string) => {
    if (!disputeReason.trim()) return;
    setDisputeState('loading');
    try {
      const res = await fetch('/api/payouts/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId,
          reason: disputeReason,
          expectedAmountCents: Math.round(parseFloat(disputeAmount || '0') * 100),
        }),
      });
      setDisputeState(res.ok ? 'done' : 'error');
      if (res.ok) setTimeout(() => { setDisputeSheetShowId(null); setDisputeState('idle'); setDisputeReason(''); setDisputeAmount(''); }, 2000);
    } catch { setDisputeState('error'); }
  };

  const trackList = data.tracks;
  const clips = trackList.length > 0
    ? trackList.map((tr, i) => ({
        n: String(i + 1).padStart(2, '0'),
        t: tr.title,
        m: `${tr.artistName} · ${tr.album}`,
        type: 'TRACK' as const,
        d: tr.duration,
      }))
    : [];
  const timelineColors = [T.accent, T.pink, T.purple, T.teal, T.blue, T.amber];
  const timeline = trackList.length > 0
    ? trackList.map((tr, i) => ({
        c: timelineColors[i % timelineColors.length],
        f: Math.round(100 / trackList.length),
        t: tr.title,
      }))
    : [
        { c: T.accent, f: 14, t: 'Intro' },
        { c: T.pink,   f: 18, t: 'Sundown' },
        { c: T.purple, f: 22, t: 'Westline' },
        { c: T.teal,   f: 8,  t: 'Talk' },
        { c: T.blue,   f: 20, t: 'Underpass' },
        { c: T.amber,  f: 18, t: 'Halflight' },
      ];

  return (
    <>
      <WMViewHead
        eyebrow="SHOW CREATOR · PRERECORDED RADIO"
        title="Studio"
        sub="Drag tracks into the timeline. Splits auto-calc: 45/45/10."
        actions={<>
          <WMChip>↥ Import</WMChip>
          <WMChip accent>⬤ Publish</WMChip>
          <WMChip onClick={handleCopyEmbed}>{embedCopied ? '✓ Copied!' : '⊞ Embed'}</WMChip>
          <WMChip onClick={() => setFanMailOpen(true)}>✉ Fan mail</WMChip>
        </>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Composer card */}
        <div style={{ background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${T.line}` }}>
            <div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 17, color: T.ink }}>Halflight FM · Ep 05</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em', marginTop: 3 }}>47:00 · 6 tracks · Sun Jun 22 · 10AM</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
              <WMPill tone="amber">SCHEDULED</WMPill>
              <WMPill>CO 15%</WMPill>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: T.bg3, borderRadius: 9, padding: 12, marginTop: 12, border: `1px solid ${T.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em', marginBottom: 8 }}>
              <span>00:00</span><span>15:00</span><span>30:00</span><span>47:00</span>
            </div>
            <div style={{ position: 'relative', height: 46, background: T.bg4, borderRadius: 5, display: 'flex', gap: 2, padding: 3, overflow: 'hidden' }}>
              {timeline.map((c, i) => (
                <div key={i} style={{
                  flex: `0 0 ${c.f}%`, height: '100%', background: c.c, borderRadius: 3,
                  display: 'flex', alignItems: 'center', padding: '0 6px',
                  fontFamily: T.fm, fontSize: 12, fontWeight: 700, color: T.bg, letterSpacing: '.04em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative',
                }}>
                  {c.t}
                  <span style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 2px,transparent 2px 4px)' }} />
                </div>
              ))}
              {/* playhead */}
              <div style={{ position: 'absolute', top: -3, bottom: -3, left: '32%', width: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}`, zIndex: 3 }}>
                <div style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: '50%', background: T.accent }} />
              </div>
            </div>
          </div>

          {/* Clip list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
            {clips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', background: T.bg3, borderRadius: 10, border: `1px dashed ${T.line2}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 28 }}>🎵</div>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink }}>No tracks yet</div>
                <div style={{ fontFamily: T.fb, fontSize: 13, color: T.ink3, lineHeight: 1.4 }}>Upload your first track to get started</div>
                <a href="/upload" style={{ marginTop: 4, padding: '8px 20px', borderRadius: 99, background: T.accent, color: T.bg, fontFamily: T.fd, fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>+ Upload track</a>
              </div>
            ) : clips.map((c, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'center',
                padding: '7px 10px', borderRadius: 6, background: T.bg3, border: `1px solid ${T.line}`,
              }}>
                <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, fontWeight: 700 }}>{c.n}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{c.t}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.m}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: T.fm, fontSize: 7, color: T.ink2, letterSpacing: '.12em', padding: '2px 6px', borderRadius: 99, background: T.bg2, border: `1px solid ${T.line2}`, textTransform: 'uppercase', fontWeight: 700 }}>{c.type}</span>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>{c.d}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
            <WMChip>+ Track</WMChip>
            <WMChip>⏵ Voice</WMChip>
            <WMChip style={{ marginLeft: 'auto' }} accent>Save draft</WMChip>
          </div>
          {/* Schedule release */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>Schedule:</div>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              style={{ flex: 1, background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 7, color: T.ink, fontFamily: T.fm, fontSize: 12, padding: '6px 8px', outline: 'none' }}
            />
          </div>
        </div>

        {/* Revenue split */}
        <WMCard style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 13, color: T.ink }}>Revenue split · Ep 05</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>per spin</div>
          </div>
          <div style={{ height: 14, borderRadius: 99, overflow: 'hidden', background: T.bg3, display: 'flex' }}>
            <div style={{ width: '45%', background: T.accent }} />
            <div style={{ width: '30%', background: T.pink }} />
            <div style={{ width: '15%', background: T.purple }} />
            <div style={{ width: '10%', background: T.ink3 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontFamily: T.fm, fontSize: 12, color: T.ink2, letterSpacing: '.04em' }}>
            {([['Artist 45%', T.accent], ['Host 30%', T.pink], ['Co-host 15%', T.purple], ['Platform 10%', T.ink3]] as [string, string][]).map(([l, c], i) => (
              <div key={i}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, marginRight: 5, verticalAlign: 'middle' }} />{l}</div>
            ))}
          </div>
        </WMCard>

        {/* Drafts */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink, margin: 0 }}>My drafts</h2>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>4 total</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {[
            { t: 'Halflight FM · Ep 04', m: '8 tracks · 60:00 · 2,284 plays',   pill: ['teal',  'PUBLISHED'], r: '$184.20', g: `linear-gradient(135deg,${T.accent},${T.amber})` },
            { t: 'Halflight FM · Ep 05', m: '6 tracks · 47:00 · Sun Jun 22',    pill: ['amber', 'EDITING'],   r: 'co 15%',  g: `linear-gradient(135deg,${T.accent},${T.pink})`,  curr: true },
            { t: 'Writing room',         m: '5 tracks · 35:00 · unscheduled',   pill: ['soft',  'DRAFT'],     r: '—',       g: `linear-gradient(135deg,${T.blue},${T.bg4})` },
            { t: 'Sundown · back-half',  m: '4 tracks · 30:00 · co: DJ Vex 10%',pill: ['soft',  'DRAFT'],     r: '—',       g: `linear-gradient(135deg,${T.pink},${T.purple})` },
          ].map((d, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 10, alignItems: 'center',
              background: d.curr ? 'rgba(255,80,41,.04)' : T.bg2,
              border: `1px solid ${d.curr ? T.accent : T.line}`, borderRadius: 9, padding: 10,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 6, background: d.g }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{d.t}</div>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.m}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                <WMPill tone={d.pill[0]}>{d.pill[1]}</WMPill>
                <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>{d.r}</span>
                {d.pill[1] === 'PUBLISHED' && (
                  <button
                    onClick={() => setDisputeSheetShowId(d.t)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.amber, fontFamily: T.fm, fontSize: 11, padding: 0, fontWeight: 700 }}
                  >
                    Dispute payout →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fan mail sheet */}
      {fanMailOpen && (
        <>
          <div onClick={() => setFanMailOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Email your fans</div>
            <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink3, marginBottom: 14 }}>Send a message to all your followers. Limited to once per 7 days.</div>
            {fanMailState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.teal, fontFamily: T.fb }}>Mail sent!</div>
            ) : (
              <>
                <input
                  type="text"
                  value={fanMailSubject}
                  onChange={e => setFanMailSubject(e.target.value.slice(0, 100))}
                  placeholder="Subject (max 100 chars)"
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                />
                <textarea
                  value={fanMailContent}
                  onChange={e => setFanMailContent(e.target.value.slice(0, 2000))}
                  placeholder="Message to your fans… (max 2000 chars)"
                  rows={5}
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                />
                <button
                  onClick={handleFanMail}
                  disabled={fanMailState === 'loading' || !fanMailSubject.trim() || !fanMailContent.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: (fanMailSubject.trim() && fanMailContent.trim()) ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4, color: (fanMailSubject.trim() && fanMailContent.trim()) ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: (fanMailSubject.trim() && fanMailContent.trim()) ? 'pointer' : 'default' }}
                >
                  {fanMailState === 'loading' ? 'Sending…' : fanMailState === 'error' ? 'Failed — retry' : 'Send to fans'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Dispute payout sheet */}
      {disputeSheetShowId && (
        <>
          <div onClick={() => setDisputeSheetShowId(null)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Dispute payout</div>
            <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink3, marginBottom: 14 }}>Submit a payout dispute for admin review.</div>
            {disputeState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.teal, fontFamily: T.fb }}>Dispute submitted!</div>
            ) : (
              <>
                <input
                  type="number"
                  value={disputeAmount}
                  onChange={(e) => setDisputeAmount(e.target.value)}
                  placeholder="Expected payout amount ($)"
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                />
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value.slice(0, 500))}
                  placeholder="Describe the issue with your payout…"
                  rows={4}
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                />
                <button
                  onClick={() => handleDispute(disputeSheetShowId)}
                  disabled={disputeState === 'loading' || !disputeReason.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: disputeReason.trim() ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4, color: disputeReason.trim() ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: disputeReason.trim() ? 'pointer' : 'default' }}
                >
                  {disputeState === 'loading' ? 'Submitting…' : disputeState === 'error' ? 'Failed — retry' : 'Submit dispute'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── Screen: Ticketing ───────────────────────────────────────
function ScreenTicketing({ data, onHypersSheet, onRadioTab }: { data: WorkbenchData; onHypersSheet?: (showId: string) => void; onRadioTab?: () => void }) {
  const [subTab, setSubTab] = useState(0);
  const subTabs = ['Upcoming', 'My Tickets', 'Past', 'Sell'];
  const [resendState, setResendState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [transferSheetOrderId, setTransferSheetOrderId] = React.useState<string | null>(null);
  const [transferEmail, setTransferEmail] = React.useState('');
  const [transferState, setTransferState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleResend = async () => {
    setResendState('loading');
    try {
      const res = await fetch('/api/tickets/resend-confirmation', { method: 'POST' });
      setResendState(res.ok ? 'done' : 'error');
      setTimeout(() => setResendState('idle'), 3000);
    } catch { setResendState('error'); setTimeout(() => setResendState('idle'), 3000); }
  };

  const handleTransfer = async (orderId: string) => {
    if (!transferEmail.trim()) return;
    setTransferState('loading');
    try {
      const res = await fetch(`/api/tickets/${orderId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: transferEmail }),
      });
      if (res.ok) {
        setTransferState('done');
        setTimeout(() => { setTransferSheetOrderId(null); setTransferState('idle'); setTransferEmail(''); }, 2000);
      } else {
        setTransferState('error');
      }
    } catch { setTransferState('error'); }
  };

  return (
    <>
      <WMViewHead
        eyebrow="LIVE EVENTS · SERIALIZED · ON-PLATFORM RESALE"
        title="Ticketing"
        sub="Buy. Reassign anytime. 45/45/10 — artist, venue, promoter — every time."
        actions={<><WMChip>⌕ Search</WMChip><WMChip>⌖ Near Chicago ▾</WMChip></>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 2, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {subTabs.map((t, i) => (
            <button key={t} onClick={() => setSubTab(i)} style={{
              padding: '7px 12px', borderRadius: 6, fontFamily: T.fm, fontSize: 12, fontWeight: 600,
              letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
              background: i === subTab ? T.bg3 : 'transparent', color: i === subTab ? T.ink : T.ink3, border: 'none',
            }}>{t}</button>
          ))}
        </div>

        {/* Event cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {data.shows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14, background: T.bg2, borderRadius: 12, border: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🎟️</div>
              No tickets yet —{' '}
              <button onClick={onRadioTab} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontFamily: T.fb, fontSize: 14, padding: 0, textDecoration: 'underline' }}>
                find shows near you in Radio →
              </button>
            </div>
          )}
          {data.shows.map((e, i) => {
            const pct = e.capacity > 0 ? (e.sold / e.capacity) * 100 : 0;
            const isHot = pct > 85 || e.status === 'TONIGHT';
            return (
              <div key={e.id} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 110, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg,${data.tracks[i % data.tracks.length]?.color ?? T.accent},${T.bg4})` }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,.8) 100%)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
                    <WMPill tone={e.status === 'TONIGHT' ? 'live' : e.status === 'NEAR SOLD' ? 'pink' : 'soft'}>
                      {e.status === 'TONIGHT' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />}
                      {e.status}
                    </WMPill>
                  </div>
                  <button onClick={() => onHypersSheet?.(e.id)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, fontFamily: T.fm, fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', padding: '4px 9px', borderRadius: 99, border: 'none', cursor: 'pointer' }}>
                    ♥ {e.hype}
                  </button>
                  <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 2, color: '#fff' }}>
                    <h3 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 20, letterSpacing: '-.025em', margin: 0 }}>{e.name}</h3>
                    <p style={{ fontFamily: T.fm, fontSize: 12, color: 'rgba(255,255,255,.78)', letterSpacing: '.1em', margin: '3px 0 0', textTransform: 'uppercase' }}>{e.venue} · CHICAGO</p>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink, fontWeight: 600, letterSpacing: '.06em' }}>{e.date} · {e.time}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>{e.sold}/{e.capacity} sold</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <a href={`/api/shows/${e.id}/qr`} target="_blank" rel="noreferrer" style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, textDecoration: 'none', padding: '5px 8px', borderRadius: 6, border: `1px solid ${T.line2}`, letterSpacing: '.06em' }}>QR</a>
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, letterSpacing: '-.025em', color: T.ink }}>${e.price}</div>
                    <button style={{
                      padding: '7px 14px', borderRadius: 7, fontFamily: T.fm, fontSize: 12, fontWeight: 700,
                      letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: T.bg,
                      background: isHot ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.ink,
                    }}>Buy</button>
                  </div>
                </div>
                <div style={{ width: '100%', height: 4, background: T.bg, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${T.accent},${T.pink})`, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* My tickets */}
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 15, color: T.ink, margin: 0 }}>My Tickets</h2>
            <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>{data.tickets.length} active</span>
          </div>
          {data.tickets.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontFamily: T.fb, fontSize: 13, color: T.ink3 }}>
              No tickets yet.
            </div>
          )}
          {data.tickets.map((tk, i, arr) => {
            const isWait = tk.status === 'WAITLIST';
            return (
              <div key={tk.id} style={{
                display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 12, alignItems: 'center',
                padding: '12px 16px', borderBottom: i === arr.length - 1 ? 'none' : `1px dashed ${T.line}`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 6, border: `1px dashed ${isWait ? T.amber : T.line2}`,
                  background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 34, height: 34, opacity: isWait ? .3 : .7, background: `linear-gradient(90deg,${T.ink} 1px,transparent 1px) 0 0/5px 5px, linear-gradient(0deg,${T.ink} 1px,transparent 1px) 0 0/5px 5px` }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{tk.showName}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>{tk.date}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', marginTop: 3 }}>{tk.code}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, fontWeight: 600, letterSpacing: '.08em' }}>{tk.seat}</span>
                  <WMPill tone={isWait ? 'amber' : 'teal'}>{tk.status}</WMPill>
                  {tk.showId && <IWasThereButton showId={tk.showId} />}
                  {tk.id && (
                    <button
                      onClick={() => setTransferSheetOrderId(tk.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontFamily: T.fm, fontSize: 11, padding: 0, fontWeight: 700 }}
                    >
                      Transfer →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Resend confirmation */}
        <button
          onClick={handleResend}
          disabled={resendState === 'loading'}
          style={{ width: '100%', marginBottom: 12, padding: '10px 0', borderRadius: 8, border: `1px solid ${T.line2}`, background: 'transparent', color: resendState === 'done' ? T.teal : T.ink2, fontFamily: T.fm, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {resendState === 'idle' && 'Resend ticket confirmation email'}
          {resendState === 'loading' && 'Sending…'}
          {resendState === 'done' && '✓ Email sent!'}
          {resendState === 'error' && 'Failed — try again'}
        </button>
      </div>

      {/* Transfer sheet */}
      {transferSheetOrderId && (
        <>
          <div onClick={() => setTransferSheetOrderId(null)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Transfer ticket</div>
            {transferState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.teal, fontFamily: T.fb }}>Ticket transferred!</div>
            ) : (
              <>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  placeholder="Recipient email address"
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
                />
                <button
                  onClick={() => handleTransfer(transferSheetOrderId)}
                  disabled={transferState === 'loading' || !transferEmail.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: transferEmail.trim() ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4, color: transferEmail.trim() ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: transferEmail.trim() ? 'pointer' : 'default' }}
                >
                  {transferState === 'loading' ? 'Transferring…' : transferState === 'error' ? 'Failed — retry' : 'Transfer'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── Feedback sheet ───────────────────────────────────────────
function WMFeedbackSheet({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = React.useState<'bug' | 'suggestion' | 'other'>('bug');
  const [message, setMessage] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/support/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, category, url: typeof window !== 'undefined' ? window.location.href : '' }),
      });
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
        background: T.bg3, borderTop: `1px solid ${T.line2}`,
        borderRadius: '18px 18px 0 0',
        boxShadow: '0 -12px 48px rgba(0,0,0,.7)',
        padding: '20px 18px 40px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, letterSpacing: '-.025em' }}>Send feedback</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.ink2, cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
        </div>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: T.fb, fontSize: 15, color: T.teal }}>
            Thanks for your feedback!
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['bug', 'suggestion', 'other'] as const).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${category === cat ? T.accent : T.line2}`,
                  background: category === cat ? 'rgba(255,80,41,.12)' : 'transparent',
                  color: category === cat ? T.accent : T.ink2,
                  fontFamily: T.fm, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer',
                }}>{cat}</button>
              ))}
            </div>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 500))}
                placeholder="Describe what happened or what you'd like to see…"
                rows={4}
                style={{
                  width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10,
                  color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px',
                  resize: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ position: 'absolute', bottom: 8, right: 10, fontFamily: T.fm, fontSize: 11, color: T.ink3 }}>{message.length}/500</div>
            </div>
            <button onClick={handleSubmit} disabled={submitting || !message.trim()} style={{
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              background: message.trim() ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4,
              color: message.trim() ? T.bg : T.ink3,
              fontFamily: T.fd, fontWeight: 800, fontSize: 15, letterSpacing: '-.01em',
              cursor: message.trim() ? 'pointer' : 'default',
              opacity: submitting ? .6 : 1,
            }}>
              {submitting ? 'Sending…' : 'Submit'}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── Collab Board Section ─────────────────────────────────────
function CollabBoardSection() {
  const [posts, setPosts] = React.useState<{ id: string; type: string; description: string; profile: { name: string; slug: string } }[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [newPost, setNewPost] = React.useState(false);
  const [postType, setPostType] = React.useState('');
  const [postDesc, setPostDesc] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [posted, setPosted] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/collab')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.posts) setPosts(d.posts.slice(0, 5)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handlePost = async () => {
    if (!postType || !postDesc.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/collab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: postType, description: postDesc }),
      });
      if (res.ok) {
        setPosted(true);
        setNewPost(false);
        setPostType('');
        setPostDesc('');
        setTimeout(() => setPosted(false), 3000);
      }
    } catch { /* ignore */ } finally { setPosting(false); }
  };

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h2 style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink, margin: 0 }}>Collab board</h2>
        <button onClick={() => setNewPost(!newPost)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.teal, fontFamily: T.fm, fontSize: 12, letterSpacing: '.1em', padding: 0 }}>+ Post</button>
      </div>
      {posted && <div style={{ color: T.teal, fontFamily: T.fm, fontSize: 13, marginBottom: 8 }}>Posted!</div>}
      {newPost && (
        <div style={{ background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <input
            type="text" value={postType} onChange={e => setPostType(e.target.value.slice(0, 40))}
            placeholder="Type (e.g. vocalist, producer, venue…)"
            style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.fb, fontSize: 13, padding: '8px 10px', marginBottom: 8, boxSizing: 'border-box', outline: 'none' }}
          />
          <textarea
            value={postDesc} onChange={e => setPostDesc(e.target.value.slice(0, 500))}
            placeholder="Describe what you're looking for…"
            rows={3}
            style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.fb, fontSize: 13, padding: '8px 10px', marginBottom: 8, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
          />
          <button
            onClick={handlePost} disabled={posting || !postType || !postDesc.trim()}
            style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: (postType && postDesc.trim()) ? T.accent : T.bg4, color: (postType && postDesc.trim()) ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >{posting ? 'Posting…' : 'Post'}</button>
        </div>
      )}
      {!loaded && <WMSkeleton h={48} />}
      {loaded && posts.length === 0 && <div style={{ fontFamily: T.fb, fontSize: 13, color: T.ink3, padding: '8px 0' }}>No collab posts yet — be the first!</div>}
      {posts.map((p, i) => (
        <div key={p.id} style={{ padding: '10px 0', borderBottom: i < posts.length - 1 ? `1px dashed ${T.line}` : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 13, color: T.ink }}>{p.profile.name}</div>
            <WMPill>{p.type}</WMPill>
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, marginTop: 4, lineHeight: 1.4 }}>{p.description.slice(0, 120)}{p.description.length > 120 ? '…' : ''}</div>
        </div>
      ))}
    </div>  );
}

// ─── Screen: Listen ──────────────────────────────────────────
function ScreenListen({ data, onPlay, onExpand, currentIdx }: {
  data: WorkbenchData;
  onPlay: (i: number) => void;
  onExpand: () => void;
  currentIdx: number;
}) {
  const queue = data.tracks;
  // Static playlist shapes mapped to real data
  const playlists = [
    { n: "Tonight's Queue", meta: `${queue.length} tracks · auto-mixed`, c: T.accent },
    { n: 'Hyped by You',    meta: `${data.lifeStats?.totalHype ?? 0} hypes`,  c: T.purple },
    { n: `${data.city ?? 'Local'} Indie`, meta: 'Local scene', c: T.teal },
    { n: 'Late Drives',     meta: 'Your mix',    c: T.amber },
  ];
  // Rising = tracks sorted by hypeCount desc
  const rising = [...queue].sort((a, b) => b.hypeCount - a.hypeCount).slice(0, 5);

  const dayParts = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
  const h = new Date().getHours();
  const timeLabel = h < 12 ? dayParts[0] : h < 17 ? dayParts[1] : h < 21 ? dayParts[2] : dayParts[3];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ padding: '4px 22px 12px', flexShrink: 0 }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {timeLabel} · {data.city ?? 'YOUR CITY'}
        </div>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '6px 0 0', lineHeight: 1 }}>Listen</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 130px' }}>
        {/* Hero: resume queue */}
        <div onClick={() => { onPlay(0); onExpand(); }} style={{
          margin: '0 22px 20px', padding: 18, borderRadius: 18, position: 'relative', overflow: 'hidden', cursor: 'pointer',
          background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accent}88 32%, ${T.bg3} 100%)`,
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 18%, rgba(255,255,255,.28), transparent 55%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.bg, letterSpacing: '.16em', opacity: .85, textTransform: 'uppercase' }}>● Pick up where you left off</div>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 23, color: T.bg, marginTop: 8, lineHeight: 1.02, letterSpacing: '-.02em' }}>Tonight&#39;s Queue</div>
            <div style={{ fontFamily: T.fb, fontSize: 12, color: 'rgba(0,0,0,.65)', marginTop: 5 }}>{queue.length} tracks · finish a track to Hype it</div>
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: T.bg, color: T.ink, borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8L6 20z"/></svg> Play
            </div>
          </div>
        </div>

        {/* Your playlists */}
        <div style={{ padding: '0 22px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em' }}>Your playlists</div>
          <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.accent, letterSpacing: '.1em' }}>ALL ›</div>
        </div>
        <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 22px 4px', marginBottom: 22, scrollbarWidth: 'none' }}>
          {playlists.map((p, i) => (
            <div key={i} onClick={() => onPlay(i % Math.max(1, queue.length))} style={{ width: 130, flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ width: 130, height: 130, borderRadius: 14, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${p.c}, ${p.c}55 60%, ${T.bg3})` }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 28% 24%, rgba(255,255,255,.25), transparent 60%)' }} />
                <div style={{ position: 'absolute', left: 10, bottom: 9, fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: 'rgba(255,255,255,.95)', textShadow: '0 1px 6px rgba(0,0,0,.5)', lineHeight: 1, maxWidth: 108 }}>{p.n}</div>
              </div>
              <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.ink3, marginTop: 7, letterSpacing: '.04em' }}>{p.meta}</div>
            </div>
          ))}
        </div>

        {/* Rising in city */}
        <div style={{ padding: '0 22px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em' }}>Rising in {data.city ?? 'Your City'}</div>
          <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.purple, letterSpacing: '.1em' }}>CHARTS ›</div>
        </div>
        <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rising.length === 0 ? (
            <div style={{ padding: '20px 0', color: T.ink3, fontFamily: T.fm, fontSize: 12, textAlign: 'center' }}>No tracks yet — explore Seeds to discover music</div>
          ) : rising.map((tk, i) => (
            <div key={tk.id} onClick={() => onPlay(queue.indexOf(tk))} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 11, cursor: 'pointer',
              background: currentIdx === queue.indexOf(tk) ? `${tk.color}12` : 'transparent',
              border: `1px solid ${currentIdx === queue.indexOf(tk) ? `${tk.color}40` : 'transparent'}`,
            }}>
              <div style={{ width: 22, textAlign: 'center', fontFamily: T.fd, fontWeight: 800, fontSize: 15, color: T.ink3 }}>{i + 1}</div>
              <AlbumArt c={tk.color} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tk.title}</div>
                <div style={{ fontFamily: T.fb, fontSize: 11.5, color: T.ink3, marginTop: 1 }}>{tk.artistName}</div>
              </div>
              <div style={{ fontFamily: T.fm, fontSize: 10, color: T.pink, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>♥ {tk.hypeCount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Full Player overlay with pull-up-to-hype ─────────────────
function FullPlayer({ track, playing, onToggle, onCollapse, onHype, progress }: {
  track: WbTrack;
  playing: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onHype: () => void;
  progress: number;
}) {
  const [pull, setPull] = React.useState(0);
  const drag = React.useRef<{ y: number } | null>(null);

  const startDrag = (y: number) => { drag.current = { y }; };
  const moveDrag = (y: number) => {
    if (!drag.current) return;
    const dy = drag.current.y - y;
    setPull(Math.max(0, Math.min(1, dy / 150)));
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    setPull(p => { if (p >= 1) { onHype(); } return 0; });
  };

  const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const elapsed = Math.round(track.durationSec * progress);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      color: T.ink, fontFamily: T.fb,
      background: `linear-gradient(180deg, ${track.color}38 0%, ${T.bg} 52%), ${T.bg}`,
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px 4px' }}>
        <button onClick={onCollapse} style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.1)', border: 'none', color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-5 6l6-6-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(90 12 12)"/></svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase' }}>Now Playing</div>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>Tonight&#39;s Queue</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: T.ink, cursor: 'pointer' }}>⋯</div>
      </div>

      {/* art */}
      <div style={{ padding: '18px 30px 0' }}>
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 20, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}77 50%, ${T.bg3})`, boxShadow: `0 30px 80px ${track.color}40` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.3), transparent 55%)' }} />
          <div style={{ position: 'absolute', left: 20, bottom: 20, fontFamily: T.fd, fontWeight: 800, fontSize: 34, color: 'rgba(255,255,255,.95)', textShadow: '0 2px 14px rgba(0,0,0,.5)', letterSpacing: '-.02em', lineHeight: .95, textTransform: 'uppercase', maxWidth: '80%' }}>{track.title}</div>
        </div>
      </div>

      {/* meta */}
      <div style={{ padding: '22px 30px 0' }}>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 26, margin: 0, letterSpacing: '-.02em', lineHeight: 1 }}>{track.title}</h1>
        <div style={{ fontFamily: T.fb, fontSize: 15, color: T.ink2, marginTop: 5 }}>{track.artistName}</div>
      </div>

      {/* progress */}
      <div style={{ padding: '20px 30px 0' }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 2 }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: T.ink, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', right: -5, top: -4, width: 12, height: 12, borderRadius: 99, background: T.ink }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 8 }}>
          <span>{fmtSec(elapsed)}</span><span>{track.duration}</span>
        </div>
      </div>

      {/* transport */}
      <div style={{ padding: '14px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, padding: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M11 19V5l-9 7 9 7zm2-14v14l9-7-9-7z"/></svg>
        </button>
        <button onClick={onToggle} style={{ width: 68, height: 68, borderRadius: 99, background: T.ink, color: T.bg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
          {playing
            ? <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            : <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8L6 20z"/></svg>}
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, padding: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M13 5v14l9-7-9-7zm-11 0v14l9-7-9-7z"/></svg>
        </button>
      </div>

      {/* HYPE PULL ZONE */}
      <div
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startDrag(e.clientY); }}
        onPointerMove={e => moveDrag(e.clientY)}
        onPointerUp={endDrag}
        style={{ marginTop: 'auto', padding: '0 16px 18px', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      >
        <div style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden',
          border: `1px solid ${T.accent}${pull > 0 ? '80' : '40'}`,
          background: T.bg2, height: 64 + pull * 44,
          transition: drag.current ? 'none' : 'height .25s cubic-bezier(.2,.8,.2,1)',
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pull * 100}%`, background: `linear-gradient(180deg, ${T.accent}cc, ${T.accent})`, transition: drag.current ? 'none' : 'height .25s' }} />
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: pull > 0.5 ? T.bg : T.accent }}>
              <svg width={pull > 0.5 ? 24 : 20} height={pull > 0.5 ? 24 : 20} viewBox="0 0 24 24" fill="currentColor" style={{ transform: `scale(${1 + pull * 0.5}) translateY(${-pull * 4}px)`, transition: drag.current ? 'none' : 'transform .2s' }}>
                <path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/>
              </svg>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, letterSpacing: '-.01em' }}>
                {pull >= 1 ? 'Release to Hype' : 'Cast Hype'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: pull > 0.5 ? 'rgba(0,0,0,.6)' : T.ink3, fontFamily: T.fm, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ↑ Pull up to cast
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hype confirmation overlay ─────────────────────────────────
function HypeOverlay({ track, onDone }: { track: WbTrack; onDone: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '0 34px', textAlign: 'center',
      background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 38%, ${T.accent}33, transparent 60%)` }} />
      <div style={{
        position: 'relative', width: 140, height: 140, borderRadius: 99,
        border: `2px solid ${T.accent}`, background: `${T.accent}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30,
        animation: 'hypePop .5s cubic-bezier(.2,1.3,.4,1) both',
      }}>
        <svg width={70} height={70} viewBox="0 0 24 24" fill={T.accent}>
          <path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/>
        </svg>
        {[0, 60, 120, 180, 240, 300].map(a => (
          <div key={a} style={{ position: 'absolute', width: 6, height: 6, borderRadius: 99, background: T.accent, transform: `rotate(${a}deg) translateY(-92px)` }} />
        ))}
      </div>
      <div style={{ position: 'relative', fontFamily: T.fm, fontSize: 9, color: T.accent, letterSpacing: '.18em', textTransform: 'uppercase' }}>● Hype Cast · Verified</div>
      <h1 style={{ position: 'relative', fontFamily: T.fs, fontStyle: 'italic', fontWeight: 400, fontSize: 40, letterSpacing: '-.02em', margin: '14px 0 0', lineHeight: 1 }}>
        You hyped<br/>
        <span style={{ fontFamily: T.fd, fontStyle: 'normal', fontWeight: 800, color: T.accent }}>{track.title}.</span>
      </h1>
      <p style={{ position: 'relative', fontFamily: T.fb, fontSize: 13, color: T.ink2, marginTop: 14, maxWidth: 280, lineHeight: 1.5 }}>
        1 of <strong style={{ color: T.ink }}>389</strong> real fans behind {track.artistName} this week. It just moved up the chart.
      </p>
      <div style={{ position: 'relative', display: 'flex', gap: 10, marginTop: 26 }}>
        <button onClick={onDone} style={{ padding: '12px 18px', background: T.bg2, color: T.ink, border: `1px solid ${T.line2}`, borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Keep listening</button>
        <button onClick={onDone} style={{ padding: '12px 18px', background: T.accent, color: T.bg, border: 'none', borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>See the chart →</button>
      </div>
    </div>
  );
}

// ─── Screen: Shows (new design) ───────────────────────────────
function ScreenShowsNew({ data }: { data: WorkbenchData }) {
  const [showView, setShowView] = React.useState<'list' | 'detail' | 'ticket'>('list');
  const [selected, setSelected] = React.useState<WbShow | null>(null);
  const shows = data.shows;

  if (showView === 'detail' && selected) {
    return <ShowDetailNew show={selected} onBack={() => setShowView('list')} onBuy={() => setShowView('ticket')} />;
  }
  if (showView === 'ticket' && selected) {
    return <TicketFlowNew show={selected} onBack={() => setShowView('detail')} onDone={() => setShowView('list')} />;
  }

  const tonight = shows.filter(s => s.status === 'TONIGHT');
  const thisWeek = shows.filter(s => s.status === 'THIS WEEK' || s.status === 'UPCOMING');
  const sections = [
    { label: 'TONIGHT', items: tonight },
    { label: 'THIS WEEK', items: thisWeek },
  ].filter(s => s.items.length > 0);

  const totalShows = shows.length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ padding: '4px 22px 12px', flexShrink: 0 }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.teal, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          ● {totalShows > 0 ? `${totalShows} Shows` : 'Shows'} in {data.city ?? 'Your City'} · 0% Fees
        </div>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '6px 0 0', lineHeight: 1 }}>Shows</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 130px' }}>
        {/* 0% fees banner */}
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: `${T.teal}10`, border: `1px solid ${T.teal}40`, display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: T.teal, color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>0%</div>
          <div>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13 }}>Every ticket. 0% fees.</div>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2 }}>Face value goes to the artist &amp; venue. Always.</div>
          </div>
        </div>

        {shows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14 }}>
            No shows right now — check back soon
          </div>
        )}

        {sections.map(sec => (
          <div key={sec.label} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.18em', marginBottom: 8, textTransform: 'uppercase' }}>{sec.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sec.items.map(show => (
                <div key={show.id} onClick={() => { setSelected(show); setShowView('detail'); }}
                  style={{ padding: 12, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
                  <AlbumArt c={show.hype > 100 ? T.accent : T.teal} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, letterSpacing: '-.01em' }}>{show.name}</div>
                    <div style={{ fontFamily: T.fb, fontSize: 11.5, color: T.ink2, marginTop: 2 }}>{show.venue}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, marginTop: 3, letterSpacing: '.06em' }}>{show.date} · {show.time}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15 }}>${show.price}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, marginTop: 2, letterSpacing: '.1em' }}>FACE</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowDetailNew({ show, onBack, onBuy }: { show: WbShow; onBack: () => void; onBuy: () => void }) {
  const pct = show.capacity > 0 ? Math.round(show.sold / show.capacity * 100) : 0;
  const showColor = show.hype > 100 ? T.accent : T.teal;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {/* hero */}
        <div style={{ height: 190, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a22, #0e0e14)' }} />
          <svg width="100%" height="100%" viewBox="0 0 390 190" style={{ position: 'absolute', inset: 0 }}>
            <g stroke="rgba(255,255,255,.06)" fill="none" strokeWidth="1">
              {Array.from({ length: 9 }).map((_, i) => <line key={'h' + i} x1="0" y1={i * 22} x2="390" y2={i * 22} />)}
              {Array.from({ length: 18 }).map((_, i) => <line key={'v' + i} x1={i * 24} y1="0" x2={i * 24} y2="190" />)}
              <path d="M0 100 Q120 90 180 120 T390 80" stroke="rgba(255,255,255,.14)" strokeWidth="2"/>
            </g>
            <circle cx="200" cy="105" r="14" fill={showColor} fillOpacity=".2"/><circle cx="200" cy="105" r="8" fill={showColor}/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 55%, ${T.bg} 100%)` }} />
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, padding: '0 18px', display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)', border: 'none', color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M19 12H5m5-6-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        <div style={{ padding: '4px 22px 12px' }}>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: showColor, letterSpacing: '.14em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: showColor, display: 'inline-block' }}/>{show.status} · {show.time}
          </div>
          <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 28, letterSpacing: '-.025em', margin: '8px 0 0', lineHeight: 1 }}>{show.name}</h1>
          <div style={{ fontFamily: T.fb, fontSize: 14, color: T.ink2, marginTop: 5 }}>{show.venue}</div>
        </div>

        {/* demand bar */}
        <div style={{ padding: '0 22px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>Fan demand · {show.sold} / {show.capacity}</div>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: pct > 80 ? T.accent : T.teal, letterSpacing: '.06em', textTransform: 'uppercase' }}>{pct > 80 ? 'Hot' : 'On sale'}</div>
          </div>
          <div style={{ height: 6, background: T.bg2, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${T.teal}, ${T.accent})` }} />
          </div>
          <div style={{ fontFamily: T.fb, fontSize: 11, color: T.ink3, marginTop: 6 }}>{show.capacity - show.sold} left</div>
        </div>
      </div>

      {/* buy bar */}
      <div style={{ padding: '14px 22px 24px', borderTop: `1px solid ${T.line}`, background: T.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', lineHeight: 1 }}>${show.price}</div>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.teal, letterSpacing: '.08em', textTransform: 'uppercase' }}>+ $0 Fees</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', textAlign: 'right', maxWidth: 130, lineHeight: 1.3, textTransform: 'uppercase' }}>100% to artist + venue</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBuy} style={{ flex: 1, padding: 14, background: T.teal, color: T.bg, border: 'none', borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="15" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="15" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><path d="M14 14h3v3h-3zm5 0h2v2h-2zm-5 5h3v2h-3zm5 0h2v2h-2z" stroke="currentColor" strokeWidth="1.4"/></svg>
            Get ticket
          </button>
          <button style={{ padding: '14px 16px', background: T.bg2, color: T.ink, border: `1px solid ${T.line2}`, borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>RSVP</button>
        </div>
      </div>
    </div>
  );
}

function TicketFlowNew({ show, onBack, onDone }: { show: WbShow; onBack: () => void; onDone: () => void }) {
  const [bought, setBought] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const showColor = show.hype > 100 ? T.accent : T.teal;

  const handleBuy = async () => {
    setLoading(true);
    try {
      await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: show.id }),
      });
      setBought(true);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ padding: '14px 22px 4px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 34, height: 34, borderRadius: 99, background: T.bg2, border: `1px solid ${T.line2}`, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M19 12H5m5-6-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 16 }}>{bought ? 'Your ticket' : 'Checkout'}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 130px', display: 'flex', flexDirection: 'column' }}>
        {/* ticket stub */}
        <div style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${T.line2}`, background: T.bg2 }}>
          <div style={{ height: 120, position: 'relative', background: `linear-gradient(135deg, ${showColor}, ${showColor}66 60%, ${T.bg3})` }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 75% 25%, rgba(255,255,255,.25), transparent 60%)' }} />
            <div style={{ position: 'absolute', left: 18, bottom: 14 }}>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: 'rgba(0,0,0,.6)', letterSpacing: '.14em' }}>{show.date} · {show.time}</div>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, color: 'rgba(255,255,255,.97)', textShadow: '0 1px 8px rgba(0,0,0,.4)', lineHeight: 1, marginTop: 3 }}>{show.name}</div>
            </div>
          </div>
          {/* perforation */}
          <div style={{ position: 'relative', height: 0 }}>
            <div style={{ position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: 99, background: T.bg }} />
            <div style={{ position: 'absolute', right: -8, top: -8, width: 16, height: 16, borderRadius: 99, background: T.bg }} />
            <div style={{ borderTop: `2px dashed ${T.line2}`, margin: '0 14px' }} />
          </div>
          <div style={{ padding: 18 }}>
            {bought ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 150, height: 150, borderRadius: 12, background: '#fff', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(11,1fr)', gap: 2 }}>
                  {Array.from({ length: 121 }).map((_, i) => {
                    const on = (i * 7 % 13 + i % 5 + ((i * i) % 9)) % 3 === 0 || [0, 1, 2, 9, 10, 11, 21, 22, 99, 109, 110, 120, 119, 118, 108].includes(i);
                    return <div key={i} style={{ background: on ? '#0a0805' : 'transparent', borderRadius: 1 }} />;
                  })}
                </div>
                <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', marginTop: 14, textTransform: 'uppercase' }}>
                  {show.id.slice(0, 8).toUpperCase()} · Scan at door
                </div>
                <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 99, background: `${T.purple}18`, color: T.purple, fontFamily: T.fm, fontSize: 11, letterSpacing: '.04em', fontWeight: 600 }}>Check in for +10 Hype · 1.5× boost</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['General admission', `$${show.price}.00`], ['Service fee', '$0.00'], ['Facility fee', '$0.00']].map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 12.5 }}>
                    <span style={{ color: T.ink3 }}>{k}</span>
                    <span style={{ color: i === 0 ? T.ink : T.teal }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 4, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.14em', color: T.ink2, textTransform: 'uppercase' }}>Total</span>
                  <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 26, color: T.teal, letterSpacing: '-.02em' }}>${show.price}.00</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {!bought && (
          <div style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 13, color: T.ink3, marginTop: 14, lineHeight: 1.45, textAlign: 'center' }}>
            Every cent of your ${show.price} goes to {show.name} and {show.venue}. iHYPE takes nothing.
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          {bought
            ? <button onClick={onDone} style={{ width: '100%', padding: 15, background: T.bg2, color: T.ink, border: `1px solid ${T.line2}`, borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Done</button>
            : <button onClick={handleBuy} disabled={loading} style={{ width: '100%', padding: 15, background: T.teal, color: T.bg, border: 'none', borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="15" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="15" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><path d="M14 14h3v3h-3zm5 0h2v2h-2zm-5 5h3v2h-3zm5 0h2v2h-2z" stroke="currentColor" strokeWidth="1.4"/></svg>
                {loading ? 'Processing...' : `Pay $${show.price} · Apple Pay`}
              </button>}
        </div>
      </div>
    </div>
  );
}

// ─── Screen: You (new design) ─────────────────────────────────
function ScreenYouNew({ data, onManage }: { data: WorkbenchData; onManage: () => void }) {
  const isCreator = data.activeProfileTypes.includes('ARTIST') || data.activeProfileTypes.includes('VENUE');
  const roleColor = data.activeProfileTypes.includes('VENUE') ? T.teal : data.activeProfileTypes.includes('ARTIST') ? T.accent : T.purple;
  const roleLabel = data.activeProfileTypes.includes('VENUE') ? 'VENUE' : data.activeProfileTypes.includes('ARTIST') ? 'ARTIST' : 'FAN';
  const roleForManage = data.activeProfileTypes.includes('VENUE') ? 'venue' : 'artist';

  const stats: [string, string, string][] = isCreator ? [
    [String(data.hypeCount7d ?? 0), 'Hypes · wk', T.accent],
    [String(data.listeningNow), 'Listeners', T.teal],
    [String(data.showsTonight), 'Tonight', T.purple],
  ] : [
    [String(data.lifeStats?.totalHype ?? 0), 'Hypes', T.accent],
    [String(data.lifeStats?.eventsAttended ?? 0), 'Shows', T.teal],
    [String(data.tracks.length), 'Tracks', T.purple],
  ];

  // Taste from genres — derived from track genres or stats
  const taste: [string, number, string][] = [
    ['Indie', 42, T.accent], ['Bedroom Pop', 38, T.accent],
    ['Shoegaze', 18, T.purple], ['House', 14, T.purple],
    ['Folk', 9, T.teal], ['Punk', 6, T.amber],
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 130px' }}>
        {/* identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(135deg, ${roleColor}, ${T.accent})`, color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {data.userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.02em' }}>{data.userName}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 3 }}>
              {data.profileHexId ? `iH/${data.profileHexId.slice(0, 4).toUpperCase()}` : 'iH/—'} · {data.city}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              <span style={{ fontFamily: T.fm, fontSize: 9, color: roleColor, letterSpacing: '.1em', padding: '2px 7px', border: `1px solid ${roleColor}40`, borderRadius: 99, textTransform: 'uppercase' }}>{roleLabel}</span>
              {data.isVerified && <span style={{ fontFamily: T.fm, fontSize: 9, color: T.teal, letterSpacing: '.1em', padding: '2px 7px', border: `1px solid ${T.teal}40`, borderRadius: 99 }}>● Verified</span>}
            </div>
          </div>
        </div>

        {/* Manage entry — only for creators */}
        {isCreator && (
          <button onClick={onManage} style={{ width: '100%', textAlign: 'left', marginBottom: 16, padding: 16, borderRadius: 16, cursor: 'pointer', background: `linear-gradient(135deg, ${roleColor}1c, ${T.bg2})`, border: `1px solid ${roleColor}50` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: `${roleColor}22`, color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M3 7h18M3 12h18M3 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15 }}>Manage your {roleForManage === 'venue' ? 'venue' : 'page'}</div>
                <div style={{ fontFamily: T.fm, fontSize: 10.5, color: T.ink3, marginTop: 3, letterSpacing: '.02em' }}>Quick controls here · full studio on desktop</div>
              </div>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ color: roleColor }}><path d="M5 12h14m-5-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </button>
        )}

        {/* stats */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ flex: 1, padding: 12, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12 }}>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, color: s[2], letterSpacing: '-.02em', lineHeight: 1 }}>{s[0]}</div>
              <div style={{ fontFamily: T.fm, fontSize: 8.5, color: T.ink3, marginTop: 5, letterSpacing: '.1em', textTransform: 'uppercase' }}>{s[1]}</div>
            </div>
          ))}
        </div>

        {/* taste map */}
        <div style={{ padding: 14, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14 }}>{isCreator ? 'Your audience' : 'Your taste map'}</div>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>{isCreator ? 'Top genres' : '3 new this mo'}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {taste.map(([n, s, c]) => (
              <div key={n} style={{ padding: s > 30 ? '7px 12px' : '5px 10px', borderRadius: 99, background: `${c}${s > 30 ? '22' : '12'}`, color: s > 30 ? c : T.ink2, border: `1px solid ${c}${s > 30 ? '50' : '25'}`, fontFamily: T.fd, fontWeight: s > 30 ? 700 : 600, fontSize: s > 30 ? 14 : 12 }}>
                {n} <span style={{ fontFamily: T.fm, fontWeight: 400, opacity: .65, fontSize: '80%' }}>{s}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* recent hypes */}
        <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.18em', marginBottom: 8, textTransform: 'uppercase' }}>
          {isCreator ? 'Recent fan hypes' : 'Recent hypes'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {data.activity.slice(0, 4).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: T.bg3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13 }}>{a.text}</div>
                <div style={{ fontFamily: T.fb, fontSize: 11, color: T.ink3, marginTop: 1 }}>{a.time}</div>
              </div>
              {a.kind === 'hype' && <div style={{ padding: '3px 8px', background: `${T.purple}20`, color: T.purple, borderRadius: 99, fontFamily: T.fm, fontSize: 9, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>♥ hyped</div>}
            </div>
          ))}
          {data.activity.length === 0 && (
            <div style={{ color: T.ink3, fontFamily: T.fm, fontSize: 12, padding: '8px 0' }}>Start exploring — hype tracks to build your history</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manage Console (creator) ─────────────────────────────────
function ManageConsole({ data, onExit }: { data: WorkbenchData; onExit: () => void }) {
  const isVenue = data.activeProfileTypes.includes('VENUE');
  const rc = isVenue ? T.teal : T.accent;
  const name = data.userName;
  const [live, setLive] = React.useState(true);

  const stats: [string, string, string][] = isVenue ? [
    ['$1,830', 'Sold tonight', T.teal],
    [String(data.showsTonight), 'Shows', T.accent],
    [String(data.listeningNow), 'Live', T.purple],
  ] : [
    [String(data.hypeCount7d ?? 0), 'Hypes · wk', T.accent],
    ['#3', 'Rising', T.purple],
    [String(data.showsTonight), 'Tonight', T.teal],
  ];

  const quick = isVenue ? [
    { t: "Post tonight's lineup", d: 'Pushes to fans within 3 mi', ic: 'megaphone' as const },
    { t: 'Approve booking request', d: `${data.pendingVenueRequestCount ?? 0} pending`, ic: 'inbox' as const, badge: String(data.pendingVenueRequestCount ?? '') || undefined },
    { t: 'Update door + capacity', d: `Capacity ${data.shows[0]?.capacity ?? 0}`, ic: 'edit' as const },
  ] : [
    { t: 'Post an update', d: 'New single, show, or note to fans', ic: 'megaphone' as const },
    { t: 'Reply to a booking', d: '1 offer pending', ic: 'inbox' as const, badge: '1' as const },
    { t: "Set tonight's setlist", d: 'Becomes a hype signal at the show', ic: 'edit' as const },
  ];

  const desktop = isVenue ? [
    { t: 'Venue page design', d: 'Layout, photos, brand', link: '/home' },
    { t: 'Calendar & ticketing', d: 'Full season, allocations, holds', link: '/home' },
    { t: 'Booking matchmaker', d: 'Find artists that fit your room', link: '/home' },
    { t: 'Ad campaigns', d: 'Local / regional coverage', link: '/advertise' },
  ] : [
    { t: 'Artist page studio', d: 'Bio, photos, layout, links', link: '/home' },
    { t: 'AI Page Studio', d: 'Generate press kit & visuals', link: '/home' },
    { t: 'Radio show creator', d: 'Build & schedule a show', link: '/home' },
    { t: 'Ad campaigns', d: 'Promote a release or tour', link: '/advertise' },
  ];

  const ICON = {
    megaphone: (c: string) => <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M4 10v4a1 1 0 001 1h2l5 4V5L7 9H5a1 1 0 00-1 1z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/><path d="M16 8.5a4 4 0 010 7" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>,
    inbox:     (c: string) => <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M3 13l3-8h12l3 8M3 13v6h18v-6M3 13h5l1 2h6l1-2h5" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/></svg>,
    edit:      (c: string) => <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb, background: T.bg }}>
      {/* manage header */}
      <div style={{ padding: '10px 20px 14px', borderBottom: `1px solid ${T.line}`, background: `${rc}0c`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 99, background: T.bg2, border: `1px solid ${T.line2}`, color: T.ink, fontFamily: T.fm, fontSize: 10.5, letterSpacing: '.06em', cursor: 'pointer' }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none"><path d="M19 12H5m5-6-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> Fan App
          </button>
          <div style={{ marginLeft: 'auto', fontFamily: T.fm, fontSize: 9, color: rc, letterSpacing: '.16em', padding: '4px 9px', border: `1px solid ${rc}40`, borderRadius: 99, textTransform: 'uppercase' }}>Manage Mode</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
          <div>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{isVenue ? 'Venue' : 'Artist'} Console</div>
            <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 26, letterSpacing: '-.025em', margin: '5px 0 0', lineHeight: 1 }}>{name}</h1>
          </div>
          <button onClick={() => setLive(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 99, background: T.bg2, border: `1px solid ${live ? T.teal + '60' : T.line2}`, cursor: 'pointer' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: live ? T.teal : T.ink3, boxShadow: live ? `0 0 8px ${T.teal}` : 'none', flexShrink: 0 }} />
            <span style={{ fontFamily: T.fm, fontSize: 10, fontWeight: 600, letterSpacing: '.06em', color: live ? T.teal : T.ink3, textTransform: 'uppercase' }}>{live ? 'Live' : 'Offline'}</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 30px' }}>
        {/* stats */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '12px 12px', background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12 }}>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, color: s[2], letterSpacing: '-.02em', lineHeight: 1 }}>{s[0]}</div>
              <div style={{ fontFamily: T.fm, fontSize: 8, color: T.ink3, marginTop: 5, letterSpacing: '.1em', textTransform: 'uppercase' }}>{s[1]}</div>
            </div>
          ))}
        </div>

        {/* quick tasks */}
        <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.18em', marginBottom: 10, textTransform: 'uppercase' }}>Quick — do it from your phone</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {quick.map((q, i) => (
            <button key={i} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, padding: 14, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 13, cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${rc}18`, color: rc, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ICON[q.ic](rc)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14 }}>{q.t}</div>
                <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2, letterSpacing: '.02em' }}>{q.d}</div>
              </div>
              {q.badge && <div style={{ minWidth: 20, height: 20, borderRadius: 99, background: rc, color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{q.badge}</div>}
            </button>
          ))}
        </div>

        {/* desktop punts */}
        <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.18em', marginBottom: 6, textTransform: 'uppercase' }}>Build on desktop</div>
        <div style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 13, color: T.ink3, marginBottom: 12, lineHeight: 1.4 }}>
          Heavy lifting — page design, ticketing, AI tools — is built for a big screen.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {desktop.map((dk, i) => (
            <a key={i} href={dk.link} style={{ display: 'block', padding: '13px 14px', background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 13, cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: T.bg3, border: `1px solid ${T.line2}`, color: T.ink3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13.5 }}>{dk.t}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2 }}>{dk.d}</div>
                </div>
                <span style={{ padding: '7px 11px', borderRadius: 8, border: `1px solid ${rc}45`, color: rc, fontFamily: T.fm, fontSize: 9.5, letterSpacing: '.04em', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Open <svg width={11} height={11} viewBox="0 0 24 24" fill="none"><path d="M14 5h5v5M19 5l-8 8M11 5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-5" stroke={rc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main mobile export ───────────────────────────────────────
export function WorkbenchMobile({ data }: { data: WorkbenchData }) {
  const [liveData, setLiveData] = useState<WorkbenchData>(data);
  const [tab, setTab] = useState<MobileTab>('listen');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.42);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hypeTrack, setHypeTrack] = useState<WbTrack | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const pullDeltaRef = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  // Client-side revalidation — clears degraded banner after DB cold-start recovery
  useEffect(() => {
    fetch('/api/workbench')
      .then(r => r.ok ? r.json() : null)
      .then((freshData: WorkbenchData | null) => { if (freshData) setLiveData(freshData); })
      .catch(() => {});
  }, []);

  const currentTrack = liveData.tracks[currentTrackIdx % Math.max(liveData.tracks.length, 1)];
  const track = currentTrack ?? liveData.tracks[0];

  // Real audio playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.mediaUrl) return;
    if (audio.src !== currentTrack.mediaUrl) {
      audio.src = currentTrack.mediaUrl;
      audio.load();
    }
    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing, currentTrackIdx, currentTrack]);

  // Sync progress from audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnded = () => {
      setCurrentTrackIdx(ci => (ci + 1) % Math.max(liveData.tracks.length, 1));
      setProgress(0);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [liveData.tracks.length]);

  // Fallback tick when no mediaUrl
  useEffect(() => {
    if (!playing || !track || track.mediaUrl) return;
    const iv = setInterval(() => {
      setProgress(p => {
        const next = p + 1 / track.durationSec;
        return next >= 1 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, track]);

  const TABS_ORDER: MobileTab[] = ['listen', 'seeds', 'shows', 'you'];
  const tabSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const tabSwipeLocked = useRef<'h' | 'v' | null>(null);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    await new Promise(r => setTimeout(r, 900));
    setRefreshing(false);
  }, [refreshing]);

  function handleMainTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    pullStartY.current = t.clientY;
    tabSwipeStart.current = { x: t.clientX, y: t.clientY };
    tabSwipeLocked.current = null;
  }

  function handleMainTouchMove(e: React.TouchEvent) {
    const t = e.touches[0];
    if (tab !== 'seeds') {
      const el = e.currentTarget as HTMLElement;
      if (el.scrollTop === 0) {
        const dy = t.clientY - pullStartY.current;
        if (dy > 0) {
          pullDeltaRef.current = Math.min(dy * 0.4, 70);
          setPullDelta(pullDeltaRef.current);
        }
      }
    }
    if (tabSwipeStart.current && !tabSwipeLocked.current) {
      const dx = t.clientX - tabSwipeStart.current.x;
      const dy = t.clientY - tabSwipeStart.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        tabSwipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
    }
  }

  function handleMainTouchEnd(e: React.TouchEvent) {
    if (pullDeltaRef.current > 50) handleRefresh();
    pullDeltaRef.current = 0;
    setPullDelta(0);
    if (tabSwipeLocked.current === 'h' && tabSwipeStart.current) {
      const dx = e.changedTouches[0].clientX - tabSwipeStart.current.x;
      if (Math.abs(dx) > 60 && tab !== 'seeds') {
        const idx = TABS_ORDER.indexOf(tab);
        if (dx < 0 && idx < TABS_ORDER.length - 1) setTab(TABS_ORDER[idx + 1]);
        if (dx > 0 && idx > 0) setTab(TABS_ORDER[idx - 1]);
      }
    }
    tabSwipeStart.current = null;
    tabSwipeLocked.current = null;
  }

  const screenEl = (() => {
    switch (tab) {
      case 'listen': return <ScreenListen data={liveData} onPlay={setCurrentTrackIdx} onExpand={() => setExpanded(true)} currentIdx={currentTrackIdx} />;
      case 'seeds':  return <ScreenSeeds data={liveData} />;
      case 'shows':  return <ScreenShowsNew data={liveData} />;
      case 'you':    return <ScreenYouNew data={liveData} onManage={() => setManageMode(true)} />;
    }
  })();

  if (manageMode) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden' }}>
        <style>{eqCss}</style>
        <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />
        <ManageConsole data={liveData} onExit={() => setManageMode(false)} />
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden' }}>
      <style>{eqCss}</style>
      <style>{`@keyframes hypePop { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      {liveData.degraded && (
        <div style={{ background: '#f59e0b', color: '#000', textAlign: 'center', padding: '6px 12px', fontSize: 12, fontWeight: 600, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          Having trouble connecting — some data may be outdated
        </div>
      )}
      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />

      {/* Main scrollable area */}
      <div
        role="main"
        className="wm-scroll"
        style={{ flex: 1, overflowY: tab === 'seeds' ? 'hidden' : 'auto', overflowX: 'hidden', position: 'relative', scrollbarWidth: 'none' }}
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
      >
        {tab !== 'seeds' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: pullDelta > 0 ? pullDelta : refreshing ? 44 : 0,
            overflow: 'hidden', transition: refreshing ? 'none' : 'height .2s',
            fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.12em',
          }}>
            {refreshing ? (
              <><span className="wm-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />REFRESHING</>
            ) : pullDelta > 40 ? '↓ RELEASE' : pullDelta > 10 ? '↓ PULL TO REFRESH' : null}
          </div>
        )}
        <ViewErrorBoundary viewName={tab}>{screenEl}</ViewErrorBoundary>
      </div>

      {/* Mini player sits above tab bar */}
      {track && !expanded && (
        <WMMiniPlayer
          track={track}
          playing={playing}
          onToggle={() => setPlaying(p => !p)}
          progress={progress}
          onAlbumTap={() => setExpanded(true)}
        />
      )}

      {/* Bottom tab bar */}
      <WMBottomTabs tab={tab} onTab={setTab} />

      {/* Full player overlay */}
      {expanded && track && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <FullPlayer
            track={track}
            playing={playing}
            onToggle={() => setPlaying(p => !p)}
            onCollapse={() => setExpanded(false)}
            onHype={() => { setHypeTrack(track); setExpanded(false); }}
            progress={progress}
          />
        </div>
      )}

      {/* Hype confirmation overlay */}
      {hypeTrack && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
          <HypeOverlay track={hypeTrack} onDone={() => setHypeTrack(null)} />
        </div>
      )}
    </div>
  );
}

