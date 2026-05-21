'use client';

import React, { useState, useEffect } from 'react';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { WorkbenchExtras } from '@/components/WorkbenchExtras';
import {
  type WorkbenchData,
  type View,
  type WbActivity,
  type StarterPackItem,
  type Prefs,
  WbSkeleton,
  IcBolt,
  IcArrow,
  IcPlay,
  IcHeart,
  IcDot,
} from '@/components/WorkbenchShell';

// ── Activity color map ─────────────────────────────────────────
const ACTIVITY_COLORS: Record<WbActivity['kind'], string> = {
  hype: '#ff3e9a',
  show: '#22e5d4',
  radio: '#b983ff',
  payout: '#ffb84a',
  request: '#7fb3ff',
  security: '#ff5029'
};

// ── WbFirstSteps ───────────────────────────────────────────────
export function WbFirstSteps({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem('ihype-firststeps-dismissed') === '1') setDismissed(true);
    } catch {}
  }, []);
  const completionPercent = data.profileCompletion?.percent ?? 0;
  if (dismissed || completionPercent >= 100) return null;
  const type = data.profileType ?? data.activeProfileTypes[0] ?? 'LISTENER';
  const roleName = type === 'DJ' ? 'promoter' : type === 'VENUE' ? 'venue' : type === 'ARTIST' ? 'artist' : 'fan';
  const completion = data.profileCompletion ?? { percent: 0, missing: ['Add profile details'] };
  const nextMissing = completion.missing.slice(0, 2).join(' + ') || 'Keep momentum going';
  const roleAction = type === 'ARTIST'
    ? { label: 'Add media', text: 'Upload or feature the track fans should hear first.', view: 'artist' as View }
    : type === 'VENUE'
    ? { label: 'Open ticketing', text: 'Put the first bookable night in motion.', view: 'venue' as View }
    : type === 'DJ'
    ? { label: 'Create a show', text: 'Start a show lane artists and fans can follow.', view: 'studio' as View }
    : { label: 'Discover seeds', text: 'Save three artists to tune the feed.', view: 'seeds' as View };
  const roleProfileText = type === 'VENUE'
    ? 'Add room details, contact, hours, and booking context.'
    : type === 'ARTIST'
    ? 'Add story, image, genres, contact, and a first media/show signal.'
    : type === 'DJ'
    ? 'Add the nights, scenes, artists, and contact details you champion.'
    : 'Add taste signals so recommendations become personal.';

  return (
    <section className="wb-panel wb-first-steps">
      <div className="wb-panel-head">
        <div>
          <div className="wb-panel-title">First 3 moves for your {roleName} lane</div>
          <div className="wb-small-muted">{completion.percent}% page strength - {nextMissing}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="wb-completion-ring" aria-label={`Profile completion ${completion.percent}%`}>
            <span>{completion.percent}%</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss getting-started checklist"
            onClick={() => {
              try { localStorage.setItem('ihype-firststeps-dismissed', '1'); } catch {}
              setDismissed(true);
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
      </div>
      {completion.checks?.length ? (
        <div className="wb-quality-list" aria-label="Public page readiness">
          {completion.checks.map((check) => (
            <span className={check.ok ? 'complete' : ''} key={check.label}>{check.label}</span>
          ))}
        </div>
      ) : null}
      <div className="wb-first-step-grid">
        <button className="wb-first-step" onClick={() => setView('settings')} type="button">
          <strong>Complete profile</strong>
          <span>{roleProfileText}</span>
        </button>
        <button className="wb-first-step" onClick={() => setView(roleAction.view)} type="button">
          <strong>{roleAction.label}</strong>
          <span>{roleAction.text}</span>
        </button>
        <a className="wb-first-step" href={data.profilePath ?? '/home'}>
          <strong>View public page</strong>
          <span>Check the page others see.</span>
        </a>
      </div>
    </section>
  );
}

// ── StarterPackPanel ───────────────────────────────────────────
export function StarterPackPanel({ items }: { items: StarterPackItem[] }) {
  const [hypedIds, setHypedIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem('ihype-starter-dismissed') === '1') setDismissed(true); } catch {}
  }, []);
  if (dismissed || !items.length) return null;
  async function hype(id: string) {
    if (hypedIds.has(id)) return;
    setHypedIds((s) => new Set(s).add(id));
    try {
      await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'profile', targetId: id }),
      });
    } catch {}
  }
  return (
    <section className="wb-panel" style={{ marginBottom: 16 }}>
      <div className="wb-panel-head">
        <div>
          <div className="wb-panel-title">Starter pack — seed your feed</div>
          <div className="wb-small-muted">Tap HYPE on a few artists to personalize recommendations.</div>
        </div>
        <button
          type="button"
          onClick={() => { try { localStorage.setItem('ihype-starter-dismissed', '1'); } catch {} setDismissed(true); }}
          aria-label="Dismiss starter pack"
          style={{ background: 'transparent', border: 'none', color: 'var(--wb-ink-3)', cursor: 'pointer', fontSize: 18 }}
        >×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
        {items.map((a) => {
          const hyped = hypedIds.has(a.id);
          return (
            <div key={a.id} style={{ padding: 12, border: '1px solid var(--wb-line, #2a2622)', borderRadius: 10, background: 'var(--wb-bg-2, #181513)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 2 }}>
                {[a.genre, a.city].filter(Boolean).join(' · ') || 'Independent'}
              </div>
              <button
                type="button"
                onClick={() => hype(a.id)}
                disabled={hyped}
                className="wb-btn-prime"
                style={{ marginTop: 10, padding: '6px 12px', fontSize: 11, width: '100%' }}
              >
                {hyped ? '✓ Hyped' : `HYPE · ${a.hypeCount}`}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── VerificationRequestBanner ──────────────────────────────────
export function VerificationRequestBanner({ profileId }: { profileId: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function request() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/profile/verify-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
      if (res.ok) setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="wb-card" style={{ marginBottom: 16, padding: '12px 16px', borderLeft: '3px solid #22e5d4' }}>
        <span style={{ fontSize: 13 }}>Verification request submitted. Our team will review it shortly.</span>
      </div>
    );
  }

  return (
    <div className="wb-card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13 }}>Get verified to unlock booker-visible signals and the verified badge.</span>
      <button className="wb-btn-prime" disabled={busy} onClick={() => void request()} style={{ flexShrink: 0, fontSize: 12 }}>
        {busy ? 'Sending…' : 'Request Verification'}
      </button>
    </div>
  );
}

// ── ShareAndGrowCard ───────────────────────────────────────────
export function ShareAndGrowCard({ data }: { data: WorkbenchData }) {
  const [copied, setCopied] = useState(false);
  const types = data.activeProfileTypes || [];
  const isArtistOrDJ = types.includes('ARTIST') || types.includes('DJ');
  if (!data.profilePath) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ihype.org';
  const referralUrl = `${origin}/register?ref=${data.profileHexId}`;
  const profileUrl = `${origin}${data.profilePath ?? ''}`;
  const primaryUrl = isArtistOrDJ && data.profileHexId ? referralUrl : profileUrl;
  const primaryLabel = isArtistOrDJ ? 'Copy referral' : 'Copy profile';
  const primaryCopy = isArtistOrDJ
    ? 'Share your referral link for attribution. Promoter payouts only happen when the referred person buys a ticketed show.'
    : types.includes('VENUE')
    ? 'Share your venue page so artists, promoters, and fans can find shows and booking context.'
    : 'Share your fan page to show the artists, venues, and events shaping your scene.';
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <section className="wb-panel" style={{ marginTop: 16, padding: '18px 22px', background: 'linear-gradient(135deg, rgba(185,131,255,0.08), rgba(34,229,212,0.05))', border: '1px solid rgba(185,131,255,0.25)' }}>
      <div className="wb-eyebrow" style={{ color: '#b983ff', marginBottom: 6 }}>● SHARE &amp; GROW</div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--wb-ink)', marginBottom: 4 }}>Invite fans &amp; build your network</div>
      <p className="wb-page-sub" style={{ marginBottom: 12, fontSize: 13 }}>{primaryCopy}</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input readOnly value={primaryUrl} style={{ flex: 1, padding: '8px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-accent)', outline: 'none' }} onClick={(e) => (e.target as HTMLInputElement).select()} />
        <button className="wb-btn-prime" onClick={() => copy(primaryUrl)} style={{ whiteSpace: 'nowrap' }}>{copied ? 'Copied ✓' : primaryLabel}</button>
      </div>
      {isArtistOrDJ ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input readOnly value={profileUrl} style={{ flex: 1, padding: '8px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-2)', outline: 'none' }} onClick={(e) => (e.target as HTMLInputElement).select()} />
        <button className="wb-btn-ghost" onClick={() => copy(profileUrl)} style={{ whiteSpace: 'nowrap' }}>Copy profile</button>
      </div> : null}
    </section>
  );
}

// ── VenueIncomingRequestsCard ──────────────────────────────────
export function VenueIncomingRequestsCard({ data }: { data: WorkbenchData }) {
  const types = data.activeProfileTypes || [];
  if (!types.includes('VENUE')) return null;
  const count = data.pendingVenueRequestCount ?? 0;
  if (count <= 0) return null;
  return (
    <section className="wb-panel" style={{ marginTop: 16, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(34,229,212,0.06)', border: '1px solid rgba(34,229,212,0.25)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,229,212,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-d)', fontWeight: 700, color: '#22e5d4', fontSize: 16 }}>{count}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>Incoming connection request{count === 1 ? '' : 's'}</div>
        <div className="wb-page-sub" style={{ margin: 0, fontSize: 12 }}>Artists and fans want to recommend acts to your venue.</div>
      </div>
      {data.profilePath ? (
        <a className="wb-btn-prime" href={`${data.profilePath}?section=request`} style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>Review →</a>
      ) : null}
    </section>
  );
}

// ── RoleNextActionHub ──────────────────────────────────────────
export function RoleNextActionHub({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const type = data.profileType ?? data.activeProfileTypes[0] ?? 'LISTENER';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ihype.org';
  const profileUrl = data.profilePath ? `${origin}${data.profilePath}` : origin;
  const referralUrl = data.profileHexId ? `${origin}/register?ref=${data.profileHexId}` : profileUrl;
  const cards: Array<{ title: string; copy: string; action: string; view?: View; href?: string; run?: () => void | Promise<void> }> = type === 'ARTIST'
    ? [
        { title: 'Promote this week', copy: 'Share your profile, push a track, and point fans at the next show.', action: 'Share profile', run: () => navigator.clipboard?.writeText(profileUrl) },
        { title: 'Fan insights', copy: `${data.lifeStats?.totalHype ?? 0} total hypes and ${data.lifeStats?.songsPlayed ?? 0} listens are shaping your audience.`, action: 'Open artist tools', view: 'artist' as View },
        { title: 'Press kit', copy: 'Use your public page as the lightweight media kit for venues and promoters.', action: 'View page', href: data.profilePath }
      ]
    : type === 'DJ'
    ? [
        { title: 'Referral performance', copy: `${data.referralStats?.buyers ?? 0} buyers, $${((data.referralStats?.payoutCents ?? 0) / 100).toFixed(0)} estimated promoter payout.`, action: 'Open referrals', view: 'tickets' as View },
        { title: 'Curate radio', copy: 'Start a free live or prerecorded show to grow demand before ticketed events.', action: 'Create show', view: 'studio' as View },
        { title: 'Event templates', copy: 'Reuse show copy, announce links, and post-event recap language.', action: 'Create event', view: 'tickets' as View }
      ]
    : type === 'VENUE'
    ? [
        { title: 'Booking inbox', copy: `${data.pendingVenueRequestCount ?? 0} pending request${(data.pendingVenueRequestCount ?? 0) === 1 ? '' : 's'} from artists and fans.`, action: 'Review requests', view: 'venue' as View },
        { title: 'Open nights', copy: 'Use ticketing to turn available dates into confirmed shows.', action: 'Create event', view: 'tickets' as View },
        { title: 'Door tools', copy: 'QR scanning, guest list, sales, and payout status live together.', action: 'Open scanner', view: 'tickets' as View }
      ]
    : [
        { title: 'My Scene', copy: 'Hyped artists, followed venues, radio picks, and upcoming shows in one loop.', action: 'Tune feed', view: 'seeds' as View },
        { title: 'Show reminders', copy: data.shows[0] ? `Next nearby pick: ${data.shows[0].name}.` : 'Hype artists and shows to build reminders.', action: 'Browse events', view: 'tickets' as View },
        { title: 'Share discoveries', copy: 'Send a profile, show, or radio set to help the scene travel.', action: 'Discover', view: 'discover' as View }
      ];

  // suppress unused variable warning
  void referralUrl;

  return (
    <section className="wb-panel" style={{ marginBottom: 16, padding: '18px 20px' }}>
      <div className="wb-panel-head">
        <div>
          <div className="wb-panel-title">Next best actions</div>
          <div className="wb-small-muted">Role-aware moves that keep discovery, sharing, tickets, and creation connected.</div>
        </div>
      </div>
      <div className="wb-first-step-grid">
        {cards.map((card) => {
          const content = (
            <>
              <strong>{card.title}</strong>
              <span>{card.copy}</span>
              <em style={{ color: 'var(--wb-accent)', fontStyle: 'normal', fontFamily: 'var(--f-m)', fontSize: 10, marginTop: 6 }}>{card.action}</em>
            </>
          );
          if (card.href) return <a className="wb-first-step" href={card.href} key={card.title}>{content}</a>;
          return <button className="wb-first-step" key={card.title} onClick={() => card.run ? card.run() : card.view ? setView(card.view) : undefined} type="button">{content}</button>;
        })}
      </div>
      {type === 'DJ' || type === 'ARTIST' ? (
        <div className="wb-small-muted" style={{ marginTop: 12 }}>
          Referral payouts apply only when a buyer uses your referral code on a ticketed show. Radio shows remain free community curation.
        </div>
      ) : null}
    </section>
  );
}

// ── ViewInbox ──────────────────────────────────────────────────
export function ViewInbox({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const notifications = data.notifications ?? [];
  return (
    <div className="wb-view-pad" style={{ maxWidth: 900 }}>
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#7fb3ff' }}>● INBOX · ACTIONS</div>
          <h1 className="wb-page-title">Notifications</h1>
          <p className="wb-page-sub">Ticket updates, booking requests, referrals, verification, and show reminders.</p>
        </div>
      </div>
      <section className="wb-panel">
        {notifications.length === 0 ? (
          <div className="wb-empty">Nothing needs attention right now.</div>
        ) : notifications.map((n) => (
          <div key={n.id} className="wb-act-row" style={{ alignItems: 'flex-start' }}>
            <div className="wb-act-dot" style={{ background: ACTIVITY_COLORS[n.kind] }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wb-act-txt" style={{ color: 'var(--wb-ink)' }}>{n.title}</div>
              <div className="wb-small-muted" style={{ marginTop: 3 }}>{n.body}</div>
            </div>
            <div className="wb-act-time">{n.time}</div>
            {n.view ? <button className="wb-btn-ghost-sm" onClick={() => setView(n.view!)}>{n.actionLabel ?? 'Open'}</button> : null}
            {n.href ? <a className="wb-btn-ghost-sm" href={n.href} style={{ textDecoration: 'none' }}>{n.actionLabel ?? 'Open'}</a> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

// ── ViewHome ───────────────────────────────────────────────────
export function ViewHome({ data, prefs, setView, starterPack = [] }: { data: WorkbenchData; prefs: Prefs; setView: (v: View) => void; starterPack?: StarterPackItem[] }) {
  const { playTrack, currentTrack } = useMediaPlayer();
  const [copied, setCopied] = useState(false);
  const now = new Date();
  const hour = now.getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greeting = prefs.greeting === 'minimal' ? data.userName : prefs.greeting === 'data'
    ? `${data.stats[0]?.value ?? '—'} hypes this week.`
    : `Good ${tod}, ${data.userName}.`;
  const shareProfile = () => {
    const profileUrl = new URL(data.profilePath ?? '/', window.location.origin).toString();
    navigator.clipboard.writeText(profileUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wb-view-pad">
      {/* Greeting */}
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-ink-3)' }}>
            ● {now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · {(prefs.city || data.city).toUpperCase()} · {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <h1 className="wb-page-title">{greeting}</h1>
          {data.greeting && <p className="wb-page-sub">{data.greeting}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button className="wb-btn-prime" onClick={() => setView('studio')}><IcBolt s={12} /> Start a radio show</button>
          <button className="wb-btn-ghost" onClick={() => setView('tickets')}>Browse events →</button>
          <button className="wb-btn-ghost" onClick={shareProfile}>{copied ? 'Copied!' : 'Share your profile →'}</button>
        </div>
      </div>

      <WbFirstSteps data={data} setView={setView} />
      {data.profileId && !data.isVerified && !data.verificationRequested && (data.activeProfileTypes ?? []).some(t => t === 'ARTIST' || t === 'DJ') && (
        <VerificationRequestBanner profileId={data.profileId} />
      )}
      <RoleNextActionHub data={data} setView={setView} />
      <ShareAndGrowCard data={data} />
      <VenueIncomingRequestsCard data={data} />
      <WorkbenchExtras
        activeProfileTypes={data.activeProfileTypes ?? []}
        profileId={data.profileId ?? null}
        profilePath={data.profilePath ?? null}
        userEmail={null}
      />
      <StarterPackPanel items={starterPack} />

      {/* Stats */}
      {prefs.panel_stats && data.stats.length > 0 && (
        <div className="wb-stat-row">
          {data.stats.map(s => (
            <div key={s.label} className="wb-stat-card">
              <div className="wb-stat-l">{s.label}</div>
              <div className="wb-stat-v">{s.value}</div>
              <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two-col row */}
      {(prefs.panel_tonight || prefs.panel_activity) && (
        <div className="wb-col-row">
          {prefs.panel_tonight && (
            <section className="wb-panel">
              <div className="wb-panel-head">
                <div className="wb-panel-title">Tonight in {prefs.city || data.city}</div>
                <button className="wb-link-btn" onClick={() => setView('tickets')}>All events →</button>
              </div>
              <div>
                {data.shows.slice(0, 3).map(s => (
                  <div key={s.id} className="wb-show-row">
                    <div className="wb-show-stripe" style={{ background: s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : 'var(--wb-ink-3)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="wb-show-name">{s.name} <span className="wb-show-venue">· {s.venue}</span></div>
                      <div className="wb-show-meta">{s.date} · {s.time} · ♡ {s.hype}</div>
                    </div>
                    <div className="wb-cap">
                      <div className="wb-cap-bar"><div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} /></div>
                      <div className="wb-cap-txt">{s.sold}/{s.capacity}</div>
                    </div>
                    <button className="wb-row-btn"><IcArrow s={12} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {prefs.panel_activity && (
            <section className="wb-panel">
              <div className="wb-panel-head">
                <div className="wb-panel-title">Activity</div>
                <button className="wb-link-btn">Mark read</button>
              </div>
              <div>
                {data.activity.map((a, i) => (
                  <div key={i} className="wb-act-row">
                    <div className="wb-act-dot" style={{ background: ACTIVITY_COLORS[a.kind] }} />
                    <div style={{ flex: 1 }}>
                      <div className="wb-act-txt">{a.text}</div>
                    </div>
                    <div className="wb-act-time">{a.time}</div>
                  </div>
                ))}
                {data.activity.length === 0 && (
                  <div className="wb-act-row" style={{ color: 'var(--wb-ink-3)', fontSize: 13 }}>No recent activity</div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Hyped tracks */}
      {prefs.panel_hyped && data.tracks.length === 0 && (
        <section className="wb-panel" style={{ marginTop: 14 }}>
          <div className="wb-panel-head">
            <div className="wb-panel-title">Hyped this week</div>
          </div>
          <div className="wb-tracks-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <WbSkeleton height={80} style={{ borderRadius: 8 }} />
                <WbSkeleton height={12} width="80%" />
                <WbSkeleton height={10} width="60%" />
              </div>
            ))}
          </div>
        </section>
      )}
      {prefs.panel_hyped && data.tracks.length > 0 && (
        <section className="wb-panel" style={{ marginTop: 14 }}>
          <div className="wb-panel-head">
            <div className="wb-panel-title">Hyped this week</div>
            <button className="wb-link-btn" onClick={() => setView('seeds')}>Discover more →</button>
          </div>
          <div className="wb-tracks-grid">
            {data.tracks.slice(0, 6).map(t => {
              const active = currentTrack?.id === t.id;
              const mt = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
              return (
                <button key={t.id} onClick={() => playTrack(mt)} className="wb-track-card" style={{ borderColor: active ? t.color : 'var(--wb-line)' }}>
                  <div className="wb-track-art" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}>
                    <div className="wb-track-play"><IcPlay s={12} /></div>
                    <div className="wb-track-hype"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
                  </div>
                  <div className="wb-track-name">{t.title}</div>
                  <div className="wb-track-artist">{t.artistName} · {t.duration}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Lifetime heuristics */}
      <div className="wb-stat-row" style={{ marginTop: 14 }}>
        {[
          { l: 'TOTAL HYPE GIVEN', v: (data.lifeStats?.totalHype ?? 3841).toLocaleString(),   d: 'all time',          c: '#ff3e9a' },
          { l: 'TOTAL EARNINGS',   v: `$${(data.lifeStats?.totalEarnings ?? 9240).toLocaleString()}`, d: 'lifetime payouts', c: '#ffb84a' },
          { l: 'SONGS PLAYED',     v: (data.lifeStats?.songsPlayed ?? 12447).toLocaleString(), d: 'all time listens',  c: '#b983ff' },
          { l: 'EVENTS ATTENDED',  v: String(data.lifeStats?.eventsAttended ?? 28),            d: 'past tickets',      c: '#22e5d4' },
        ].map(s => (
          <div key={s.l} className="wb-stat-card">
            <div className="wb-stat-l">{s.l}</div>
            <div className="wb-stat-v">{s.v}</div>
            <div className="wb-stat-d" style={{ color: s.c }}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* Favorites row */}
      <div className="wb-col-row" style={{ marginTop: 14 }}>
        <section className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-title">Top artists</div>
            <button className="wb-link-btn" onClick={() => setView('discover')}>All →</button>
          </div>
          {[
            { name: 'Maya Reyes',    plays: 341, c: '#ff5029' },
            { name: 'Cobalt Hour',   plays: 218, c: '#b983ff' },
            { name: 'Vela',          plays: 177, c: '#22e5d4' },
            { name: 'The Lowriders', plays: 134, c: '#ff3e9a' },
          ].map(a => (
            <div key={a.name} className="wb-act-row">
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${a.c}, ${a.c}80)`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div className="wb-act-txt">{a.name}</div></div>
              <div className="wb-act-time">{a.plays} plays</div>
            </div>
          ))}
        </section>
        <section className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-title">Favorite venues</div>
            <button className="wb-link-btn" onClick={() => setView('discover')}>All →</button>
          </div>
          {[
            { name: 'Empty Bottle',   shows: 7, c: '#22e5d4' },
            { name: 'Sleeping Village', shows: 4, c: '#ff3e9a' },
            { name: 'Subterranean',   shows: 3, c: '#b983ff' },
            { name: 'Hideout',        shows: 2, c: '#ffb84a' },
          ].map(v => (
            <div key={v.name} className="wb-act-row">
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${v.c}, ${v.c}80)`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div className="wb-act-txt">{v.name}</div></div>
              <div className="wb-act-time">{v.shows} shows</div>
            </div>
          ))}
        </section>
      </div>

    </div>
  );
}
