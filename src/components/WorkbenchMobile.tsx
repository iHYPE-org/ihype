'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkbenchData, WbTrack, WbShow } from './WorkbenchShellV2';
import { SearchOverlay } from '@/components/workbench/SearchOverlay';
import { ViewErrorBoundary } from '@/components/workbench/ErrorBoundary';
import { ViewArtistPage } from '@/components/workbench/ViewArtistPage';
import { ViewVenuePage } from '@/components/workbench/ViewVenuePage';
import { ScreenListen, FullPlayer, HypeOverlay } from '@/components/workbench/MobileScreenListen';
import { MobileScreenSeeds as ScreenSeeds } from '@/components/workbench/MobileScreenSeeds';
import { ScreenShowsNew } from '@/components/workbench/MobileScreenShowsNew';
import { ScreenYouNew, ManageConsole } from '@/components/workbench/MobileScreenYouNew';
import ViewJournal from '@/components/workbench/ViewJournal';
import ViewDiscover from '@/components/workbench/ViewDiscover';
import { MobileScreenStudio } from '@/components/workbench/MobileScreenStudio';
import { ViewTour } from '@/components/workbench/ViewTour';
import { ViewNotifications } from '@/components/workbench/ViewNotifications';
import { ViewSettings } from '@/components/workbench/ViewSettings';
import ViewPageStudio from '@/components/workbench/ViewPageStudio';
import { AdvertisePage } from '@/components/AdvertisePage';
import { logoutAction } from '@/app/logout/actions';
import { WelcomeDialog } from '@/components/workbench/Overlays';
import { DEFAULT_PREFS, loadPrefs } from '@/components/workbench/types';

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

type MobileTab = 'listen' | 'seeds' | 'shows' | 'you' | 'more';

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
    listen: 'listen', seeds: 'seeds', shows: 'shows', you: 'you', more: 'more',
  };
  const navItems: { id: MobileTab; icon: string; label: string; badge?: string }[] = [
    { id: 'listen', icon: '🎵', label: 'Listen' },
    { id: 'seeds',  icon: '🌱', label: 'Seeds' },
    { id: 'shows',  icon: '🎟️', label: 'Events' },
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

// ─── More screen ─────────────────────────────────────────────
interface MoreProps { data: WorkbenchData; onStudio: () => void; onTour: () => void; onPage: () => void; onNotif: () => void; onSettings: () => void; onJournal: () => void; onDiscover: () => void; onAdvertise: () => void; }
function MobileScreenMore({ data, onStudio, onTour, onPage, onNotif, onSettings, onJournal, onDiscover, onAdvertise }: MoreProps) {
  const role = (data.profileType ?? '').toUpperCase();
  const isCreator = role === 'ARTIST' || role === 'DJ';
  const isVenue = role === 'VENUE';
  const canJournal = isCreator || isVenue;
  type Item = { label: string; sub: string; color: string; on: () => void; icon: React.ReactNode };
  const items: Item[] = [
    ...(isCreator ? [{ label: 'Studio', sub: 'Tracks, releases & tools', color: T.purple, on: onStudio, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><rect x="2" y="5" width="16" height="10" rx="2"/><path d="M6 10h1.5M10 8v4M13.5 9v2" strokeLinecap="round"/></svg> }] : []),
    { label: 'Page Creator', sub: isVenue ? 'Edit your venue page' : isCreator ? 'Edit your artist page' : 'Build your fan page', color: T.teal, on: onPage, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><rect x="2" y="2" width="16" height="16" rx="2"/><path d="M2 7h16M7 18V7"/></svg> },
    { label: 'Tour', sub: 'Booking & routing', color: T.amber, on: onTour, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><path d="M3 10h14M10 3l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    ...(canJournal ? [{ label: 'Journal', sub: 'Posts & updates', color: T.accent, on: onJournal, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><rect x="3" y="2" width="14" height="16" rx="2"/><path d="M7 7h6M7 11h4" strokeLinecap="round"/></svg> }] : []),
    { label: 'Advertise', sub: 'Promote your music', color: T.pink, on: onAdvertise, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><path d="M3 14V6l10-3v14L3 14z" strokeLinejoin="round"/><path d="M13 7l4 1v4l-4 1"/><circle cx="6.5" cy="16.5" r="1.5"/></svg> },
    { label: 'Discover', sub: 'Artists & venues', color: T.teal, on: onDiscover, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><circle cx="10" cy="10" r="7"/><path d="M13 7l-2 3-3 1.5 2-3L13 7z" fill="currentColor" stroke="none"/></svg> },
    { label: 'Notifications', sub: 'Alerts & activity', color: T.blue, on: onNotif, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><path d="M5 8a5 5 0 0 1 10 0v3.5l1.5 2.5h-13L5 11.5V8Z"/><path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round"/></svg> },
    { label: 'Settings', sub: 'Account & preferences', color: T.ink2, on: onSettings, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" strokeLinecap="round"/></svg> },
    { label: 'Sign out', sub: 'End your session', color: '#ff4444', on: () => { void logoutAction(); }, icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={22} height={22}><path d="M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3M13 14l3-4-3-4M16 10H8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ];
  return (
    <div style={{ overflowY: 'auto', padding: '20px 16px', paddingBottom: 80 }}>
      <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 18 }}>More Features</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map(item => (
          <button key={item.label} onClick={item.on} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
            padding: '16px 14px', borderRadius: 14,
            background: T.bg2, border: `1px solid ${T.line}`,
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            <div>
              <div style={{ fontFamily: T.fd, fontSize: 15, fontWeight: 700, color: T.ink }}>{item.label}</div>
              <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, marginTop: 2 }}>{item.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Bottom Tab Bar — 5-tab design (Listen · Seeds · Shows · You · More) ─
function WMBottomTabs({ tab, onTab, notifCount = 0 }: { tab: MobileTab; onTab: (t: MobileTab) => void; notifCount?: number }) {
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
    { id: 'shows', label: 'Events', icon: (s, c) => (
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
    { id: 'more', label: 'More', icon: (s, c) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="1.5" fill={c}/><circle cx="12" cy="12" r="1.5" fill={c}/><circle cx="19" cy="12" r="1.5" fill={c}/>
      </svg>
    )},
  ];
  return (
    <nav role="navigation" aria-label="Main navigation" style={{
      display: 'flex', background: 'rgba(10,8,5,.88)',
      backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
      borderTop: `1px solid ${T.line}`, padding: '10px 0 0',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
      gap: 0, flexShrink: 0,
    }}>
      {items.map(it => {
        const on = tab === it.id;
        const c = on ? T.accent : T.ink3;
        return (
          <button key={it.id} aria-label={it.label} onClick={() => { navigator.vibrate?.(8); onTab(it.id); }} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', color: c,
            fontFamily: T.fm, fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
            padding: '0 12px', cursor: 'pointer', textTransform: 'uppercase',
            minHeight: 56, minWidth: 44, position: 'relative',
          }}>
            <span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {it.icon(25, c, on && it.id === 'seeds')}
              {it.id === 'more' && notifCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -4, minWidth: 16, height: 16, borderRadius: 99, background: T.accent, border: `1.5px solid rgba(10,8,5,.88)`, fontFamily: T.fm, fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
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
  const [journalMode, setJournalMode] = useState(false);
  const [discoverMode, setDiscoverMode] = useState(false);
  const [studioMode, setStudioMode] = useState(false);
  const [tourMode, setTourMode] = useState(false);

  const [pageMode, setPageMode] = useState(false);
  const [advertiseMode, setAdvertiseMode] = useState(false);
  const [notifMode, setNotifMode] = useState(false);
  const [settingsMode, setSettingsMode] = useState(false);
  const [prefs, setPrefs] = useState<typeof DEFAULT_PREFS>(DEFAULT_PREFS);
  const setPref = useCallback((k: string, v: unknown) => setPrefs(p => ({ ...p, [k]: v })), []);
  useEffect(() => { setPrefs(loadPrefs()); }, []);
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => { if (!localStorage.getItem('ihype-welcome-seen')) setShowWelcome(true); }, []);
  const [nudgeDismissed, setNudgeDismissed] = useState(true);
  useEffect(() => { setNudgeDismissed(!!localStorage.getItem('profileNudgeDismissed')); }, []);
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; color: string }[]>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((msg: string, color = T.teal) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, msg, color }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);
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

  const TABS_ORDER: MobileTab[] = ['listen', 'seeds', 'shows', 'you', 'more'];
  const tabSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const tabSwipeLocked = useRef<'h' | 'v' | null>(null);
  const scrollPositions = useRef<Partial<Record<MobileTab, number>>>({});
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const edgeSwipeRef = useRef<{ x: number; y: number } | null>(null);

  function handleOverlayTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    edgeSwipeRef.current = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null;
  }

  function makeOverlayTouchEnd(onClose: () => void) {
    return (e: React.TouchEvent) => {
      if (!edgeSwipeRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - edgeSwipeRef.current.x;
      const dy = Math.abs(t.clientY - edgeSwipeRef.current.y);
      edgeSwipeRef.current = null;
      if (dx > 80 && dy < 60) { navigator.vibrate?.(8); onClose(); }
    };
  }

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    try {
      const res = await fetch('/api/workbench');
      if (res.ok) { const fresh = await res.json() as WorkbenchData; if (fresh) setLiveData(fresh); }
    } catch { showToast('Failed to refresh', T.accent); } finally {
      setRefreshing(false);
    }
  }, [refreshing, showToast]);

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

  useEffect(() => {
    requestAnimationFrame(() => {
      if (mainScrollRef.current) mainScrollRef.current.scrollTop = scrollPositions.current[tab] ?? 0;
    });
  }, [tab]);

  const screenEl = (() => {
    switch (tab) {
      case 'listen': return <ScreenListen data={liveData} onPlay={setCurrentTrackIdx} onExpand={() => setExpanded(true)} currentIdx={currentTrackIdx} />;
      case 'seeds':  return <ScreenSeeds data={liveData} />;
      case 'shows':  return <ScreenShowsNew data={liveData} onToast={showToast} />;
      case 'you':    return <ScreenYouNew data={liveData} onManage={() => setManageMode(true)} onJournal={() => setJournalMode(true)} onDiscover={() => setDiscoverMode(true)} />;
      case 'more':   return <MobileScreenMore data={liveData} onStudio={() => setStudioMode(true)} onTour={() => setTourMode(true)} onPage={() => setPageMode(true)} onNotif={() => setNotifMode(true)} onSettings={() => setSettingsMode(true)} onJournal={() => setJournalMode(true)} onDiscover={() => setDiscoverMode(true)} onAdvertise={() => setAdvertiseMode(true)} />;
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

  if (journalMode) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onTouchStart={handleOverlayTouchStart} onTouchEnd={makeOverlayTouchEnd(() => setJournalMode(false))}>
        <style>{eqCss}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 10px', borderBottom: `1px solid ${T.line}` }}>
          <button onClick={() => setJournalMode(false)} style={{ background: 'none', border: 'none', color: T.accent, fontFamily: T.fm, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>← Back</button>
          <span style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 16 }}>Journal</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ViewJournal data={liveData} />
        </div>
      </div>
    );
  }

  if (discoverMode) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onTouchStart={handleOverlayTouchStart} onTouchEnd={makeOverlayTouchEnd(() => setDiscoverMode(false))}>
        <style>{eqCss}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 10px', borderBottom: `1px solid ${T.line}` }}>
          <button onClick={() => setDiscoverMode(false)} style={{ background: 'none', border: 'none', color: T.teal, fontFamily: T.fm, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>← Back</button>
          <span style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 16 }}>Discover</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ViewDiscover data={liveData} />
        </div>
      </div>
    );
  }

  const overlayModes: { active: boolean; close: () => void; title: string; color: string; children: React.ReactNode; scroll?: boolean }[] = [
    { active: studioMode,    close: () => setStudioMode(false),    title: 'Studio',        color: T.purple, children: <MobileScreenStudio data={liveData} /> },
    { active: tourMode,      close: () => setTourMode(false),      title: 'Tour',          color: T.amber,  children: <ViewTour data={liveData} /> },
    { active: pageMode,      close: () => setPageMode(false),      title: 'Page Creator',  color: T.teal,   children: <ViewPageStudio data={liveData} />, scroll: true },
    { active: advertiseMode, close: () => setAdvertiseMode(false), title: 'Advertise',     color: T.pink,   children: <AdvertisePage />, scroll: true },
    { active: notifMode,     close: () => setNotifMode(false),     title: 'Notifications', color: T.blue,   children: <ViewNotifications /> },
    { active: settingsMode,  close: () => setSettingsMode(false),  title: 'Settings',      color: T.ink2,   children: <ViewSettings prefs={prefs} setPref={setPref} data={liveData} onBack={() => setSettingsMode(false)} />, scroll: true },
  ];
  for (const m of overlayModes) {
    if (m.active) return (
      <div style={{ position: 'fixed', inset: 0, background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onTouchStart={handleOverlayTouchStart} onTouchEnd={makeOverlayTouchEnd(m.close)}>
        <style>{eqCss}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 10px', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <button onClick={m.close} style={{ background: 'none', border: 'none', color: m.color, fontFamily: T.fm, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>← Back</button>
          <span style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 16 }}>{m.title}</span>
        </div>
        <div style={{ flex: 1, overflowY: m.scroll ? 'auto' : 'hidden', overflowX: 'hidden', position: 'relative', scrollbarWidth: 'none' }}>{m.children}</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden' }}>
      <style>{eqCss}</style>
      <style>{`@keyframes hypePop { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />

      {/* Main scrollable area */}
      <div
        ref={mainScrollRef}
        role="main"
        className="wm-scroll"
        style={{ flex: 1, overflowY: tab === 'seeds' ? 'hidden' : 'auto', overflowX: 'hidden', position: 'relative', scrollbarWidth: 'none' }}
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
        onScroll={e => { scrollPositions.current[tab] = (e.currentTarget as HTMLDivElement).scrollTop; }}
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
        {!isOnline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,80,41,.1)', borderBottom: `1px solid rgba(255,80,41,.2)` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontFamily: T.fm, fontSize: 11, color: T.accent, letterSpacing: '.08em' }}>No connection — changes won&apos;t save</span>
          </div>
        )}
        {!nudgeDismissed && tab !== 'seeds' && (liveData.profileCompletion?.percent ?? 100) < 100 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(255,184,74,.12)', borderBottom: `1px solid rgba(255,184,74,.25)` }}>
            <button onClick={() => setSettingsMode(true)} style={{ fontFamily: T.fm, fontSize: 11, color: 'rgba(255,184,74,.9)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '.06em', minHeight: 'unset' }}>
              Complete your profile ({liveData.profileCompletion?.percent ?? 0}%) →
            </button>
            <button onClick={() => { localStorage.setItem('profileNudgeDismissed', '1'); setNudgeDismissed(true); }} style={{ fontFamily: T.fm, fontSize: 16, color: T.ink3, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1, minHeight: 'unset' }} aria-label="Dismiss">×</button>
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
      <WMBottomTabs tab={tab} onTab={setTab} notifCount={liveData.notifications?.length ?? 0} />

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

      {showWelcome && (
        <WelcomeDialog
          onDismiss={() => { localStorage.setItem('ihype-welcome-seen', '1'); setShowWelcome(false); }}
          onNavigate={(v) => { if (v === 'seeds') setTab('seeds'); }}
        />
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 140, zIndex: 200, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              padding: '10px 14px', borderRadius: 10,
              background: T.bg3, border: `1px solid ${t.color}40`,
              fontFamily: T.fb, fontSize: 13, color: T.ink,
              boxShadow: '0 8px 24px rgba(0,0,0,.5)',
              animation: 'fadeIn .15s ease-out both',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

