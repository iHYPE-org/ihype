'use client';

import React, { useEffect, useState } from 'react';

type DailyShow = { id: string; title: string; slug: string; startsAt: string; hypeCount: number; isLocal: boolean };
type DailyProfile = { id: string; name: string; slug: string; type: string; city: string; genre: string; hypeCount: number; avatarImage: string };
type DailyTrack = { id: string; hexId: string; title: string; artistName: string; artistPath: string };
type DailyPicks = { show: DailyShow | null; profile: DailyProfile | null; track: DailyTrack | null };

const DISMISS_KEY = 'ihype-discover-daily-dismissed';

function fmtShowTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function DailyRow({ href, icon, iconColor, label, title, meta }: {
  href: string; icon: string; iconColor: string; label: string; title: string; meta: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 10,
        border: '1px solid var(--line)', background: 'var(--bg-3)',
        textDecoration: 'none', minWidth: 0, flex: '1 1 220px',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: `${iconColor}20`, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: iconColor, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meta}
        </div>
      </div>
    </a>
  );
}

export function DiscoverDailyCard() {
  const [picks, setPicks] = useState<DailyPicks | null>(null);
  const [dismissed, setDismissed] = useState(true); // hidden until sessionStorage checked

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return; // stays dismissed
    } catch {}
    setDismissed(false);
    fetch('/api/discover/daily')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DailyPicks | null) => { if (d) setPicks(d); })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  if (dismissed || !picks) return null;
  const { show, profile, track } = picks;
  if (!show && !profile && !track) return null;

  return (
    // Container metrics match ViewMyPage's root so the card aligns with the content below it
    <div style={{ padding: '24px 48px 0', maxWidth: 1600, margin: '0 auto' }}>
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 14,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          ● Tonight near you
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss daily picks"
          style={{
            border: 'none', background: 'none', color: 'var(--ink-3)', cursor: 'pointer',
            fontFamily: 'var(--f-m)', fontSize: 14, lineHeight: 1, padding: '4px 6px',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {show && (
          <DailyRow
            href={`/shows/${show.slug}`}
            icon="🎟️"
            iconColor="#22e5d4"
            label={show.isLocal ? 'Show near you' : 'Show this week'}
            title={show.title}
            meta={`${fmtShowTime(show.startsAt)} · ${show.hypeCount.toLocaleString()} hypes`}
          />
        )}
        {profile && (
          <DailyRow
            href={`/${profile.type.toLowerCase()}s/${profile.slug}`}
            icon="♥"
            iconColor="#ff3e9a"
            label={`Trending ${profile.type.toLowerCase()}`}
            title={profile.name}
            meta={[profile.genre, profile.city].filter(Boolean).join(' · ') || `${profile.hypeCount.toLocaleString()} hypes`}
          />
        )}
        {track && (
          <DailyRow
            href={track.artistPath}
            icon="♪"
            iconColor="#b983ff"
            label="Free-use track"
            title={track.title}
            meta={`by ${track.artistName}`}
          />
        )}
      </div>
    </div>
    </div>
  );
}
