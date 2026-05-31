'use client';

// ─── Shared design tokens, primitive components, and sheets
// used by WorkbenchMobile and all MobileScreen* components.

import React from 'react';
import type { WorkbenchData } from '@/types/workbench';

// ─── Design tokens ────────────────────────────────────────────
export const T = {
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

// ─── Pill ─────────────────────────────────────────────────────
export function WMPill({ children, tone = 'soft', style }: { children: React.ReactNode; tone?: string; style?: React.CSSProperties }) {
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
export function WMChip({ children, accent = false, style, onClick }: { children: React.ReactNode; accent?: boolean; style?: React.CSSProperties; onClick?: () => void }) {
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
export function WMViewHead({ eyebrow, title, italic, sub, actions }: {
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
export function WMCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {children}
    </div>
  );
}

// ─── Skeleton block ───────────────────────────────────────────
export function WMSkeleton({ w = '100%', h = 14, r = 6, style }: { w?: string | number; h?: number; r?: number; style?: React.CSSProperties }) {
  return <div className="wm-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// ─── Trending city strip ──────────────────────────────────────
export function WMTrendingStrip({ city }: { city: string }) {
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
export function IWasThereButton({ showId }: { showId: string }) {
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

// ─── Track bottom sheet ───────────────────────────────────────
export function WMTrackSheet({ track, open, onClose }: { track: { title: string; artistName: string; album: string; color: string; hypeCount: number } | null; open: boolean; onClose: () => void }) {
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
export function WMShowHypersSheet({ showId, onClose }: { showId: string | null; onClose: () => void }) {
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
                    ? <img src={h.avatarUrl} alt={initials} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

// ─── Setlist vote sheet ───────────────────────────────────────
export function WMSetlistVoteSheet({ showId, onClose }: { showId: string | null; onClose: () => void }) {
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

export function WMGenreQuizSheet({ profileId, onComplete }: { profileId: string; onComplete: () => void }) {
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

// ─── Feedback sheet ───────────────────────────────────────────
export function WMFeedbackSheet({ onClose }: { onClose: () => void }) {
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

// ─── Referral panel ──────────────────────────────────────────
export function ReferralPanel({ data }: { data: WorkbenchData }) {
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
