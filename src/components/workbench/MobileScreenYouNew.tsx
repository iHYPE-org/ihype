'use client';
import React from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T } from './MobilePrimitives';
import { EmailPreferencesPanel } from './ViewSettings';
import { PageActions } from './PageActions';

export function ScreenYouNew({ data, onManage, onJournal, onDiscover, onToast }: { data: WorkbenchData; onManage: () => void; onJournal?: () => void; onDiscover?: () => void; onToast?: (msg: string) => void }) {
  const lpTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  function startAvatarLongPress() {
    lpTimerRef.current = setTimeout(() => {
      navigator.vibrate?.([8, 40, 8]);
      const slug = data.pageEditor?.slug;
      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${slug ?? data.profileHexId ?? ''}`;
      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ title: data.userName, url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => onToast?.('Profile link copied')).catch(() => {});
      }
    }, 600);
  }
  function cancelAvatarLongPress() {
    if (lpTimerRef.current) { clearTimeout(lpTimerRef.current); lpTimerRef.current = null; }
  }
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
          <div
            onPointerDown={startAvatarLongPress}
            onPointerUp={cancelAvatarLongPress}
            onPointerLeave={cancelAvatarLongPress}
            style={{ width: 64, aspectRatio: '1 / 1', borderRadius: 18, background: `linear-gradient(135deg, ${roleColor}, ${T.accent})`, color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}>
            {data.userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 'clamp(18px, 5.5vw, 22px)', letterSpacing: '-.02em', lineHeight: 1.1 }}>{data.userName}</div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 3 }}>
              {data.profileHexId ? `iH/${data.profileHexId.slice(0, 4).toUpperCase()}` : 'iH/—'} · {data.city}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              <span style={{ fontFamily: T.fm, fontSize: 9, color: roleColor, letterSpacing: '.1em', padding: '2px 7px', border: `1px solid ${roleColor}40`, borderRadius: 99, textTransform: 'uppercase' }}>{roleLabel}</span>
              {data.isVerified && <span style={{ fontFamily: T.fm, fontSize: 9, color: T.teal, letterSpacing: '.1em', padding: '2px 7px', border: `1px solid ${T.teal}40`, borderRadius: 99 }}>● Verified</span>}
            </div>
          </div>
        </div>

        {/* View / Share your public page (works for fans, artists, venues, DJs) */}
        <PageActions
          compact
          type={data.pageEditor?.type ?? data.profileType}
          slug={data.pageEditor?.slug}
          title={data.pageEditor?.name || data.userName}
          style={{ marginBottom: 16 }}
        />

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
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 'clamp(18px, 5vw, 22px)', color: s[2], letterSpacing: '-.02em', lineHeight: 1 }}>{s[0]}</div>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, marginTop: 5, letterSpacing: '.1em', textTransform: 'uppercase', lineHeight: 1.3 }}>{s[1]}</div>
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

        {/* Quick links */}
        {(onJournal || onDiscover) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {onJournal && (
              <button onClick={onJournal} style={{ flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer', fontFamily: T.fd, fontWeight: 700, fontSize: 13, background: `rgba(255,80,41,.1)`, border: `1px solid rgba(255,80,41,.3)`, color: T.accent }}>
                📝 Journal
              </button>
            )}
            {onDiscover && (
              <button onClick={onDiscover} style={{ flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer', fontFamily: T.fd, fontWeight: 700, fontSize: 13, background: `rgba(34,229,212,.08)`, border: `1px solid rgba(34,229,212,.3)`, color: T.teal }}>
                🔍 Discover
              </button>
            )}
          </div>
        )}

        {/* Email preferences — same panel as desktop Settings */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em', marginBottom: 10 }}>Email preferences</div>
          <EmailPreferencesPanel />
        </div>
      </div>
    </div>
  );
}

export function ManageConsole({ data, onExit }: { data: WorkbenchData; onExit: () => void }) {
  const isVenue = data.activeProfileTypes.includes('VENUE');
  const rc = isVenue ? T.teal : T.accent;
  const name = data.userName;
  const [live, setLive] = React.useState(true);
  const [requests, setRequests] = React.useState(data.venueRequests?.filter(r => r.status === 'PENDING') ?? []);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const handleRequest = async (id: string, status: 'BOOKED' | 'DISMISSED') => {
    setBusyId(id);
    try {
      await fetch(`/api/venue-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch { /* ignore */ } finally { setBusyId(null); }
  };

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
          {/* Booking requests — venue only */}
          {isVenue && requests.length > 0 && (
            <>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.18em', marginTop: 8, marginBottom: 6, textTransform: 'uppercase' }}>
                Booking requests <span style={{ background: rc, color: T.bg, borderRadius: 99, padding: '1px 7px', fontFamily: T.fd, fontWeight: 800, fontSize: 9, marginLeft: 4 }}>{requests.length}</span>
              </div>
              {requests.map(r => (
                <div key={r.id} style={{ padding: '12px 14px', background: T.bg2, border: `1px solid ${T.teal}40`, borderRadius: 13 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{r.artistName}</div>
                  {r.note && <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink2, marginBottom: 8, lineHeight: 1.4 }}>{r.note.slice(0, 100)}{r.note.length > 100 ? '…' : ''}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => handleRequest(r.id, 'BOOKED')}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: T.teal, color: T.bg, fontFamily: T.fd, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: busyId === r.id ? 0.5 : 1 }}
                    >Accept</button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => handleRequest(r.id, 'DISMISSED')}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: `1px solid ${T.line2}`, background: T.bg3, color: T.ink2, fontFamily: T.fd, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: busyId === r.id ? 0.5 : 1 }}
                    >Dismiss</button>
                  </div>
                </div>
              ))}
            </>
          )}
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
