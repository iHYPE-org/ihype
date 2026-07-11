'use client';

import { useState, type ReactElement } from 'react';

type TabId = 'listen' | 'events' | 'pages';

const TABS: { id: TabId; label: string; sub: string; icon: ReactElement }[] = [
  {
    id: 'listen',
    label: 'Listen',
    sub: 'Seeds · Radio · Charts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    ),
  },
  {
    id: 'events',
    label: 'Events',
    sub: 'Shows · Tickets · Local',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    ),
  },
  {
    id: 'pages',
    label: 'Pages',
    sub: 'Profiles · Creator · Browse',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    ),
  },
];

const FEATURES: Record<TabId, { color: string; bg: string; icon: ReactElement; name: string; desc: string }[]> = {
  listen: [
    {
      color: '#ff5029', bg: 'rgba(255,80,41,.12)', name: 'Seeds',
      desc: 'Swipe music from artists near you. Hype, skip, or save — every tap feeds the demand radar.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5029" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9" /><path d="M12 8v4l3 3" /><path d="M16.24 7.76L22 2" /></svg>,
    },
    {
      color: '#22e5d4', bg: 'rgba(34,229,212,.1)', name: 'Radio',
      desc: 'Live and on-demand DJ shows. Audio only — no payola, no algorithm. Just people programming music they care about.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></svg>,
    },
    {
      color: '#b983ff', bg: 'rgba(185,131,255,.1)', name: 'Charts',
      desc: 'Rankings built from real hype votes — one member, one vote, regardless of spend. No pay-to-rank.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b983ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    },
    {
      color: '#ffb84a', bg: 'rgba(255,184,74,.1)', name: 'Playlists',
      desc: 'Build your own or follow curated playlists from artists and DJs in your city.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb84a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><line x1="9" y1="9" x2="21" y2="7" /></svg>,
    },
  ],
  events: [
    {
      color: '#ff5029', bg: 'rgba(255,80,41,.12)', name: 'Local Shows',
      desc: "See every show happening near you tonight — filtered by genre, venue, or artist you've hyped.",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5029" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    },
    {
      color: '#22e5d4', bg: 'rgba(34,229,212,.1)', name: 'My Tickets',
      desc: 'Your tickets live here. QR check-in, transfer to a friend, or replay the post-show memory card.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
    },
    {
      color: '#b983ff', bg: 'rgba(185,131,255,.1)', name: 'For You',
      desc: 'Recommended shows based on your hypes, location, and the artists you follow. Zero black box.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b983ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    },
    {
      color: '#ffb84a', bg: 'rgba(255,184,74,.1)', name: 'Search',
      desc: 'Find artists, venues, shows, or tracks — all in one place, no separate apps needed.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb84a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    },
  ],
  pages: [
    {
      color: '#ff5029', bg: 'rgba(255,80,41,.12)', name: 'My Page',
      desc: 'Your public profile — tracks, upcoming shows, bio, hype count. Artist, Venue, Fan, or DJ — each role gets its own view.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5029" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    },
    {
      color: '#22e5d4', bg: 'rgba(34,229,212,.1)', name: 'Browse',
      desc: "Explore artist, venue, and DJ pages across the city. Discover who's behind the music you've been hyping.",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    },
    {
      color: '#b983ff', bg: 'rgba(185,131,255,.1)', name: 'Page Creator',
      desc: 'Build and publish your artist, venue, or DJ page in minutes. No code, no monthly fee, no designer needed.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b983ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    },
    {
      color: '#ffb84a', bg: 'rgba(255,184,74,.1)', name: 'Referral Links',
      desc: "Share your page link. When someone buys a ticket through it, you earn your share of the 10% promoter pool automatically.",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb84a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
    },
  ],
};

export function IndexTabsShowcase() {
  const [active, setActive] = useState<TabId>('listen');

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {TABS.map(tab => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '20px 16px 18px',
                background: isActive ? 'rgba(255,80,41,.07)' : 'rgba(255,255,255,.03)',
                border: `1px solid ${isActive ? 'rgba(255,80,41,.3)' : 'rgba(255,255,255,.08)'}`,
                borderRadius: 18,
                cursor: 'pointer',
                transition: 'all 180ms cubic-bezier(.2,.7,.3,1)',
                color: isActive ? 'var(--ink)' : 'var(--ink-a55)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? 'rgba(255,80,41,.15)' : 'rgba(255,255,255,.05)',
                transition: 'background 180ms', flexShrink: 0,
              }}>
                {tab.icon}
              </div>
              <div style={{ fontFamily: 'var(--f-d)', fontSize: 'clamp(16px, 2.5vw, 22px)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>{tab.label}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: isActive ? 'rgba(255,80,41,.7)' : 'var(--ink-a35)', transition: 'color 180ms' }}>{tab.sub}</div>
            </button>
          );
        })}
      </div>

      <div className="feat-grid-index">
        {FEATURES[active].map(f => (
          <div key={f.name} style={{
            padding: 18, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10,
            transition: 'border-color 150ms, transform 150ms cubic-bezier(.2,.7,.3,1)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: f.bg }}>
              {f.icon}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 2, color: 'var(--ink)' }}>{f.name}</div>
              <p style={{ fontSize: 12, color: 'var(--ink-a55)', lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .feat-grid-index { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 768px) { .feat-grid-index { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </>
  );
}
