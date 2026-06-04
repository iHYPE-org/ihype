'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WorkbenchData } from '@/types/workbench';

/* ── types ───────────────────────────────────────────────── */
type VenueMode = 'overview' | 'shows' | 'bookings' | 'page' | 'gallery';
type Device = 'desktop' | 'mobile';

interface PageVars {
  '--p-bg': string; '--p-surface': string; '--p-ink': string; '--p-ink2': string;
  '--p-accent': string; '--p-accent2': string; '--p-line': string;
  '--p-display': string; '--p-radius': string; '--p-hero-url': string;
}
const DEFAULT_VARS: PageVars = {
  '--p-bg': '#080d0a', '--p-surface': '#101a13', '--p-ink': '#e8f4ec',
  '--p-ink2': '#7a9c84', '--p-accent': '#22e5d4', '--p-accent2': '#5fd38a',
  '--p-line': 'rgba(255,255,255,.07)', '--p-display': '"Syne",sans-serif', '--p-radius': '12px',
  '--p-hero-url': '',
};

interface Msg { side: 'me' | 'ai'; html: string; }

/* ── data constants ──────────────────────────────────────── */
const GEO_BREAKDOWN = [
  { area: 'Ukrainian Village, Chicago', followers: 380 },
  { area: 'Logan Square, Chicago', followers: 240 },
  { area: 'Wicker Park, Chicago', followers: 220 },
  { area: 'Brooklyn, NY', followers: 180 },
  { area: 'Austin, TX', followers: 140 },
];

const ARTIST_REQUESTS = [
  { id: 'ar1', name: 'Jordan Nore', genre: 'Alt-R&B', city: 'Chicago, IL', draw: 280, date: 'Jun 28', ask: '$1,200', overlap: '74%', message: "Hi! I'd love to play the room on Jun 28. I've got a solid draw in the neighborhood and my last 3 shows averaged 280 heads. Happy to do door deal or flat fee." },
  { id: 'ar2', name: 'Mau Lwin', genre: 'Bedroom Pop', city: 'Chicago, IL', draw: 180, date: 'Jul 12', ask: '$800', overlap: '68%', message: "Hey, big fan of your space. Looking for a July date — my audience skews 21–28, drinks well. I can bring my own PA if needed." },
  { id: 'ar3', name: 'The Veldt Kids', genre: 'Post-Punk', city: 'Milwaukee, WI', draw: 220, date: 'Jul 26', ask: '$1,100', overlap: '61%', message: "We're coming down from Milwaukee for a run. Your venue is exactly the vibe we want — love to do Jul 26 if you have it open." },
  { id: 'ar4', name: 'Night Transit', genre: 'Shoegaze', city: 'Indianapolis, IN', draw: 150, date: 'Aug 9', ask: '$700', overlap: '48%', message: "Expanding our touring radius — would love to add your room to an August run. Flexible on date and deal structure." },
];

const ACTIVITY = [
  { text: 'Jordan Nore sent a booking request', time: '1h ago', color: '#ff3e9a' },
  { text: '38 new followers from Brooklyn this week', time: '6h ago', color: '#22e5d4' },
  { text: 'Your HYPE count crossed 600 this month', time: '1d ago', color: '#ff5029' },
  { text: "Mau Lwin's fans are listening in your area", time: '2d ago', color: '#b983ff' },
  { text: 'Page view spike: +240% on Saturday', time: '3d ago', color: '#ffb84a' },
];

/* ── AI command interpreter ──────────────────────────────── */
function applyVenueCommand(text: string, vars: PageVars): { reply: string; applied: string[]; newVars: PageVars } {
  const t = text.toLowerCase();
  const v = { ...vars };
  const applied: string[] = [];
  const set = (k: keyof PageVars, val: string) => { v[k] = val; };

  const scenes: Record<string, Partial<PageVars>> = {
    'jazz':      { '--p-bg': '#060810', '--p-surface': '#0e1220', '--p-accent': '#b983ff', '--p-accent2': '#ff3e9a', '--p-display': '"Instrument Serif",serif' },
    'warehouse': { '--p-bg': '#060606', '--p-surface': '#101010', '--p-accent': '#ff5029', '--p-accent2': '#ffb84a', '--p-radius': '3px' },
    'dive':      { '--p-bg': '#0c0805', '--p-surface': '#1a110a', '--p-accent': '#ff5029', '--p-accent2': '#ffb84a', '--p-radius': '4px' },
    'rooftop':   { '--p-bg': '#f5f0ea', '--p-surface': '#ede5d4', '--p-ink': '#1a1612', '--p-ink2': '#6b6056', '--p-accent': '#22e5d4', '--p-line': 'rgba(0,0,0,.1)', '--p-display': '"Instrument Serif",serif' },
    'lounge':    { '--p-bg': '#080d0a', '--p-surface': '#101a13', '--p-accent': '#22e5d4', '--p-accent2': '#5fd38a' },
    'teal':      { '--p-accent': '#22e5d4' },
    'industrial':{ '--p-bg': '#050507', '--p-surface': '#0d0d12', '--p-accent': '#7fb3ff', '--p-accent2': '#ff5029', '--p-radius': '3px' },
  };

  for (const [key, theme] of Object.entries(scenes)) {
    if (t.includes(key)) {
      Object.entries(theme).forEach(([k, val]) => { v[k as keyof PageVars] = val; });
      applied.push(`Scene → ${key}`);
      break;
    }
  }

  if (/\bdark|moody|midnight/.test(t))   { set('--p-bg', '#040404'); set('--p-surface', '#0a0a0a'); applied.push('Mood → dark'); }
  if (/\blight|bright|airy/.test(t))     { set('--p-bg', '#f6f0e6'); set('--p-surface', '#ede5d6'); set('--p-ink', '#1a1612'); set('--p-ink2', '#6b6056'); set('--p-line', 'rgba(0,0,0,.1)'); applied.push('Mood → light'); }
  if (/\bserif|elegant/.test(t))         { set('--p-display', '"Instrument Serif",serif'); applied.push('Headline → serif'); }
  if (/\bsans|modern|clean/.test(t))     { set('--p-display', '"Syne",sans-serif'); applied.push('Headline → Syne'); }
  if (/\bround|soft/.test(t))            { set('--p-radius', '22px'); applied.push('Corners → rounded'); }
  if (/\bsharp|square/.test(t))          { set('--p-radius', '3px'); applied.push('Corners → sharp'); }

  const colors: Record<string, string> = { purple: '#b983ff', teal: '#22e5d4', pink: '#ff3e9a', orange: '#ff5029', amber: '#ffb84a', green: '#5fd38a', blue: '#7fb3ff' };
  for (const c in colors) {
    if (new RegExp('\\b' + c + '\\b').test(t)) { set('--p-accent', colors[c]); applied.push('Accent → ' + c); break; }
  }

  const reply = applied.length
    ? 'Done — ' + (applied.length > 1 ? applied.length + ' changes applied.' : "that's live on your venue page.")
    : 'Try "intimate jazz club", "warehouse rave", "teal & dark", "rooftop lounge", or "industrial vibe".';
  return { reply, applied, newVars: v };
}

/* ── helpers ─────────────────────────────────────────────── */
function esc(s: string) {
  return s.replace(/[&<>"]/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, color: 'var(--ink,#f4efe9)', fontFamily: 'var(--f-b,sans-serif)',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
};

/* ── RailBtn ─────────────────────────────────────────────── */
function RailBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} title={label} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: '10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
      background: active ? 'rgba(34,229,212,.12)' : 'transparent',
      color: active ? '#22e5d4' : 'rgba(244,239,233,.45)',
      transition: 'all .15s', width: '100%',
    }}>
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</span>
    </button>
  );
}

/* ── Typing dot ──────────────────────────────────────────── */
function TypingDot({ delay }: { delay: number }) {
  return (
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(244,239,233,.4)', animation: `bounce 1.2s ${delay}ms ease-in-out infinite` }}>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

/* ── main component ──────────────────────────────────────── */
export function ViewVenuePage({ data }: { data: WorkbenchData }) {
  const [mode, setMode] = useState<VenueMode>('overview');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const venueName = data.userName || 'The Venue';
  const initials = venueName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');

  const VENUE_TABS: { k: VenueMode; label: string; icon: React.ReactNode }[] = [
    { k: 'overview',  label: 'Overview',  icon: <IconOverview /> },
    { k: 'shows',     label: 'Shows',     icon: <IconShows /> },
    { k: 'bookings',  label: 'Bookings',  icon: <IconBookings /> },
    { k: 'page',      label: 'Page',      icon: <IconPageAI /> },
    { k: 'gallery',   label: 'Gallery',   icon: <IconGallery /> },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', background: 'var(--bg,#0c0a09)', overflow: 'hidden' }}>
      {/* ── left rail (desktop) ── */}
      <div style={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', background: 'var(--bg-2,#121009)', borderRight: '1px solid var(--line-2,rgba(255,255,255,.07))', overflow: 'hidden' }}>
        {/* identity */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg,#22e5d4,#5fd38a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--f-d,sans-serif)', fontSize: 13, fontWeight: 800, color: '#0a0805',
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 13, fontWeight: 700, color: 'var(--ink,#f4efe9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{venueName}</div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'var(--ink-3,rgba(244,239,233,.35))', marginTop: 1 }}>Venue · Chicago, IL</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 20, background: 'rgba(34,229,212,.08)', border: '1px solid rgba(34,229,212,.2)', fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#22e5d4' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22e5d4', display: 'inline-block' }} />
            Page live
          </div>
        </div>

        {/* nav */}
        <div style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          <RailBtn active={mode === 'overview'}  onClick={() => setMode('overview')}  label="Overview"  icon={<IconOverview />} />
          <RailBtn active={mode === 'shows'}     onClick={() => setMode('shows')}     label="Shows"     icon={<IconShows />} />
          <RailBtn active={mode === 'bookings'}  onClick={() => setMode('bookings')}  label="Bookings"  icon={<IconBookings />} />
          <RailBtn active={mode === 'page'}      onClick={() => setMode('page')}      label="Page + AI" icon={<IconPageAI />} />
          <RailBtn active={mode === 'gallery'}   onClick={() => setMode('gallery')}   label="Gallery"   icon={<IconGallery />} />
        </div>

        {/* health bar */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)' }}>Page health</span>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, color: '#22e5d4' }}>82%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '82%', background: 'linear-gradient(90deg,#22e5d4,#5fd38a)', borderRadius: 99 }} />
          </div>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.35)', marginTop: 6 }}>Add gallery to reach 90%</div>
        </div>
      </div>

      {/* ── stage ── */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingBottom: isMobile ? 58 : 0, boxSizing: 'border-box' }}>
        {mode === 'overview'  && <OverviewPanel data={data} />}
        {mode === 'shows'     && <ShowsPanel venueName={venueName} />}
        {mode === 'bookings'  && <BookingsPanel />}
        {mode === 'page'      && <PageAIPanel venueName={venueName} initials={initials} />}
        {mode === 'gallery'   && <GalleryPanel />}
      </div>

      {/* ── bottom tab bar (mobile) ── */}
      {isMobile && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 58,
          display: 'flex', alignItems: 'stretch',
          background: 'rgba(10,8,5,.96)', backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,.08)',
          gridColumn: '1 / -1',
        }}>
          {VENUE_TABS.map(t => (
            <button key={t.k} onClick={() => setMode(t.k)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, border: 'none', cursor: 'pointer', background: 'transparent',
              color: mode === t.k ? '#22e5d4' : 'rgba(244,239,233,.4)',
              transition: 'color .15s',
            }}>
              <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</span>
              <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Overview ────────────────────────────────────────────── */
function OverviewPanel({ data }: { data: WorkbenchData }) {
  const maxFollowers = Math.max(...GEO_BREAKDOWN.map(g => g.followers));
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Overview</h2>
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 28 }}>Last 30 days · updated hourly</div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
          <KpiCard label="HYPE Count"          value={(data.lifeStats?.totalHype ?? 640).toLocaleString()} delta="+22% this month"   color="#ff5029" />
          <KpiCard label="Followers"           value="1,840"  delta="+140 this month"    color="#ff3e9a" />
          <KpiCard label="Monthly Page Views"  value="12,400" delta="+31% vs last month" color="#b983ff" />
          <KpiCard label="Booking Requests"    value={(data.pendingVenueRequestCount ?? 3).toString()} delta="3 pending" color="#22e5d4" />
        </div>

        {/* Listens chart */}
        <SectionCard title="Page Views" subtitle="Daily visits over the past 30 days">
          <SparkLine color="#22e5d4" />
        </SectionCard>

        {/* AI nudge */}
        <div style={{ background: 'rgba(34,229,212,.05)', border: '1px solid rgba(34,229,212,.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16 }}>✦</span>
          <div>
            <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: '#22e5d4', marginBottom: 4 }}>Peak crowd for Post-Punk in your area is Sat 9–11pm</div>
            <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.6)', lineHeight: 1.5 }}>Your last 3 post-punk nights averaged 312 attendees vs 180 avg. The Veldt Kids' request fits that slot perfectly.</div>
          </div>
        </div>

        {/* Geo breakdown */}
        <SectionCard title="Geo Breakdown" subtitle="Where your followers are coming from">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {GEO_BREAKDOWN.map(g => (
              <div key={g.area} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 200, fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'var(--ink-2,rgba(244,239,233,.6))', flexShrink: 0 }}>{g.area}</div>
                <div style={{ flex: 1, height: 6, background: 'var(--line-2,rgba(255,255,255,.07))', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${(g.followers / maxFollowers) * 100}%`, background: 'linear-gradient(90deg, #22e5d4, #5fd38a)' }} />
                </div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, color: 'var(--ink,#f4efe9)', width: 50, textAlign: 'right', flexShrink: 0 }}>{g.followers}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Recent Activity */}
        <SectionCard title="Recent Activity" subtitle="">
          <div>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: i < ACTIVITY.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.7)' }}>{a.text}</div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', flexShrink: 0 }}>{a.time}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Shows / Calendar ────────────────────────────────────── */
function ShowsPanel({ venueName }: { venueName: string }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const showDots = new Set([15, 22, 28]);

  const [schedView, setSchedView] = useState<'list' | 'create'>('list');
  const [showTitle, setShowTitle] = useState('');
  const [showDate, setShowDate] = useState('');
  const [showTime, setShowTime] = useState('20:00');
  const [showArtist, setShowArtist] = useState('');
  const [showPrice, setShowPrice] = useState('');
  const [showCap, setShowCap] = useState('');
  const [scheduledShows, setScheduledShows] = useState([
    { id: '1', title: 'Jordan Nore', date: `${year}-${String(month + 1).padStart(2, '0')}-15`, time: '9:00 PM', cap: 180, sold: 142, price: 15 },
    { id: '2', title: 'The Veldt Kids', date: `${year}-${String(month + 1).padStart(2, '0')}-22`, time: '9:30 PM', cap: 200, sold: 85, price: 18 },
    { id: '3', title: 'Night Transit', date: `${year}-${String(month + 1).padStart(2, '0')}-28`, time: '8:00 PM', cap: 150, sold: 36, price: 12 },
  ]);

  function addShow(e: React.FormEvent) {
    e.preventDefault();
    if (!showTitle.trim() || !showDate) return;
    const d = new Date(showDate + 'T00:00');
    const day = d.getDate();
    showDots.add(day);
    setScheduledShows(prev => [{
      id: Math.random().toString(36).slice(2),
      title: showTitle.trim(),
      date: showDate,
      time: showTime,
      cap: showCap ? parseInt(showCap) : 0,
      sold: 0,
      price: showPrice ? parseFloat(showPrice) : 0,
    }, ...prev]);
    setShowTitle(''); setShowDate(''); setShowArtist(''); setShowPrice(''); setShowCap('');
    setSchedView('list');
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 4 }}>Shows</h2>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)' }}>{scheduledShows.length} scheduled · {venueName}</div>
          </div>
          {schedView === 'list' ? (
            <button onClick={() => setSchedView('create')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#22e5d4', color: '#0a0805', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
              SCHEDULE SHOW
            </button>
          ) : (
            <button onClick={() => setSchedView('list')} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(244,239,233,.5)', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          )}
        </div>

        {/* Calendar */}
        <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 14, padding: '20px 22px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink,#f4efe9)', marginBottom: 16 }}>{monthName} {year}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.3)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((day, idx) => (
              <div key={idx} style={{
                minHeight: 38, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                background: day && day === now.getDate() ? 'rgba(34,229,212,.12)' : day && showDots.has(day) ? 'rgba(255,255,255,.04)' : 'transparent',
                border: day && day === now.getDate() ? '1px solid rgba(34,229,212,.3)' : '1px solid transparent',
              }}>
                {day && <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: day === now.getDate() ? 700 : 400, color: day === now.getDate() ? '#22e5d4' : showDots.has(day) ? 'var(--ink,#f4efe9)' : 'rgba(244,239,233,.4)' }}>{day}</span>}
                {day && showDots.has(day) && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22e5d4', display: 'block' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Create form */}
        {schedView === 'create' && (
          <form onSubmit={addShow} style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 14, padding: '22px 26px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 16 }}>New Show</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <input style={INPUT_STYLE} placeholder="Show / event title *" value={showTitle} onChange={e => setShowTitle(e.target.value)} required />
              <input style={INPUT_STYLE} placeholder="Headliner / artist name" value={showArtist} onChange={e => setShowArtist(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>DATE *</div>
                  <input type="date" style={INPUT_STYLE} value={showDate} onChange={e => setShowDate(e.target.value)} required />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>DOORS</div>
                  <input type="time" style={INPUT_STYLE} value={showTime} onChange={e => setShowTime(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>TICKET PRICE (USD)</div>
                  <input type="number" min="0" step="0.01" style={INPUT_STYLE} placeholder="e.g. 15.00" value={showPrice} onChange={e => setShowPrice(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>CAPACITY</div>
                  <input type="number" min="1" style={INPUT_STYLE} placeholder="e.g. 200" value={showCap} onChange={e => setShowCap(e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="submit" style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#22e5d4', color: '#0a0805', fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em' }}>PUBLISH SHOW</button>
            </div>
          </form>
        )}

        {/* Upcoming shows */}
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 12 }}>Upcoming</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scheduledShows.map(s => {
            const pct = s.cap > 0 ? Math.round((s.sold / s.cap) * 100) : 0;
            return (
              <div key={s.id} style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 14 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, color: 'var(--ink,#f4efe9)' }}>{new Date(s.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginTop: 2 }}>{s.time}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: 'var(--ink,#f4efe9)', marginBottom: 4 }}>{s.title}</div>
                  {s.cap > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 120, height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? '#5fd38a' : '#22e5d4', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)' }}>{s.sold}/{s.cap} sold</span>
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: '#ffb84a' }}>{s.price > 0 ? `$${s.price}` : 'Free'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Bookings ────────────────────────────────────────────── */
type RequestStatus = 'pending' | 'accepted' | 'declined';

function BookingsPanel() {
  const [statuses, setStatuses] = useState<Record<string, RequestStatus>>(Object.fromEntries(ARTIST_REQUESTS.map(r => [r.id, 'pending' as RequestStatus])));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ artist: '', date: '', offer: '', message: '' });
  const [sent, setSent] = useState(false);

  function accept(id: string)  { setStatuses(s => ({ ...s, [id]: 'accepted' })); }
  function decline(id: string) { setStatuses(s => ({ ...s, [id]: 'declined' })); }

  function sendInquiry(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    setTimeout(() => { setSent(false); setInquiryForm({ artist: '', date: '', offer: '', message: '' }); }, 3000);
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Bookings</h2>
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 28 }}>Artist requests + outbound inquiries</div>

        {/* Inbound requests */}
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 14 }}>Artist Play Requests</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
          {ARTIST_REQUESTS.map(r => {
            const status = statuses[r.id];
            const isExp = expanded === r.id;
            return (
              <div key={r.id} style={{
                background: status === 'declined' ? 'rgba(255,255,255,.02)' : 'var(--bg-2,#121009)',
                border: `1px solid ${status === 'accepted' ? 'rgba(34,229,212,.25)' : status === 'declined' ? 'rgba(255,255,255,.05)' : 'var(--line-2,rgba(255,255,255,.07))'}`,
                borderRadius: 12, overflow: 'hidden',
                opacity: status === 'declined' ? 0.55 : 1,
                transition: 'all .2s',
              }}>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 15, fontWeight: 700, color: status === 'declined' ? 'rgba(244,239,233,.4)' : 'var(--ink,#f4efe9)', marginBottom: 2 }}>{r.name}</div>
                        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)' }}>{r.genre} · {r.city}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, color: '#ff3e9a', background: 'rgba(255,62,154,.1)', border: '1px solid rgba(255,62,154,.25)', padding: '3px 8px', borderRadius: 99 }}>{r.overlap} overlap</span>
                      {status === 'accepted' && <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, color: '#22e5d4', background: 'rgba(34,229,212,.1)', border: '1px solid rgba(34,229,212,.25)', padding: '3px 8px', borderRadius: 99 }}>Accepted</span>}
                      {status === 'declined' && <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', padding: '3px 8px' }}>Declined</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                    {[['EST. DRAW', r.draw.toString(), '#ffb84a'], ['DATE', r.date, 'var(--ink,#f4efe9)'], ['ASK', r.ask, '#22e5d4']].map(([label, val, color]) => (
                      <div key={label}>
                        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.35)', marginBottom: 2, letterSpacing: '.08em' }}>{label}</div>
                        <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 16, fontWeight: 700, color }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setExpanded(isExp ? null : r.id)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', background: 'transparent', border: '1px solid var(--line-2,rgba(255,255,255,.1))', color: 'var(--ink-2,rgba(244,239,233,.6))' }}
                    >
                      {isExp ? 'Hide message' : 'View request'}
                    </button>
                    {status === 'pending' && (
                      <>
                        <button onClick={() => decline(r.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, background: 'transparent', border: '1px solid rgba(255,80,41,.2)', color: '#ff5029' }}>Decline</button>
                        <button onClick={() => accept(r.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, background: 'rgba(34,229,212,.12)', border: '1px solid rgba(34,229,212,.3)', color: '#22e5d4' }}>Accept</button>
                      </>
                    )}
                  </div>
                </div>

                {isExp && (
                  <div style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 14, marginTop: 0 }}>
                    <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.35)', marginBottom: 8, letterSpacing: '.06em', textTransform: 'uppercase' }}>Their message</div>
                    <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.65)', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.message}"</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Outbound inquiry */}
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 14 }}>Send Booking Inquiry</div>
        <form onSubmit={sendInquiry} style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 14, padding: '22px 26px' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'var(--f-d,sans-serif)', fontSize: 16, fontWeight: 700, color: '#22e5d4' }}>✓ Inquiry sent</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <input style={INPUT_STYLE} placeholder="Artist name" value={inquiryForm.artist} onChange={e => setInquiryForm(f => ({ ...f, artist: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={INPUT_STYLE} placeholder="Proposed date" value={inquiryForm.date} onChange={e => setInquiryForm(f => ({ ...f, date: e.target.value }))} />
                <input style={INPUT_STYLE} placeholder="Offer / guarantee ($)" value={inquiryForm.offer} onChange={e => setInquiryForm(f => ({ ...f, offer: e.target.value }))} />
              </div>
              <textarea style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: 80 }} placeholder="Message to the artist…" value={inquiryForm.message} onChange={e => setInquiryForm(f => ({ ...f, message: e.target.value }))} rows={3} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#22e5d4', color: '#0a0805', fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em' }}>SEND INQUIRY</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ── Page + AI ───────────────────────────────────────────── */
function PageAIPanel({ venueName, initials }: { venueName: string; initials: string }) {
  const [device, setDevice] = useState<Device>('desktop');
  const [editOn, setEditOn] = useState(true);
  const [pageVars, setPageVars] = useState<PageVars>(DEFAULT_VARS);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [msgs, typing]);

  const send = useCallback(async (text: string) => {
    text = text.trim();
    if (!text) return;
    setMsgs(m => [...m, { side: 'me', html: esc(text) }]);
    setInput('');
    setTyping(true);
    const res = applyVenueCommand(text, pageVars);
    await new Promise(r => setTimeout(r, 900));
    setPageVars(res.newVars);
    setTyping(false);
    const chip = res.applied.length
      ? '<div style="margin-top:8px;padding:6px 10px;border-radius:6px;background:rgba(34,229,212,.08);border:1px solid rgba(34,229,212,.18);font-size:11px;color:#22e5d4;font-weight:700">✓ ' + res.applied.join(' · ') + '</div>'
      : '';
    setMsgs(m => [...m, { side: 'ai', html: esc(res.reply) + chip }]);
  }, [pageVars]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px' }}>
      {/* Preview */}
      <div style={{ position: 'relative', overflow: 'hidden', background: '#1a1612' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 46, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'rgba(14,11,9,.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['desktop', 'mobile'] as Device[]).map(d => (
              <button key={d} onClick={() => setDevice(d)} style={{ padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', background: device === d ? 'rgba(34,229,212,.15)' : 'transparent', color: device === d ? '#22e5d4' : 'rgba(244,239,233,.4)' }}>
                {d === 'desktop' ? '⊞ Desktop' : '▭ Mobile'}
              </button>
            ))}
          </div>
          <button onClick={() => setEditOn(e => !e)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', borderColor: editOn ? 'rgba(34,229,212,.35)' : 'rgba(255,255,255,.1)', background: editOn ? 'rgba(34,229,212,.12)' : 'transparent', color: editOn ? '#22e5d4' : 'rgba(244,239,233,.45)', fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer' }}>
            {editOn ? '✎ Editing' : '✎ Edit'}
          </button>
        </div>
        <div style={{ position: 'absolute', inset: '46px 0 0', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: device === 'mobile' ? 390 : '100%', maxWidth: device === 'mobile' ? 390 : 800, background: pageVars['--p-bg'], borderRadius: device === 'mobile' ? 32 : 0, overflow: 'hidden', minHeight: '100%', transition: 'all .4s cubic-bezier(.25,.8,.25,1)' }}>
            <VenuePublicPage venueName={venueName} initials={initials} vars={pageVars} editOn={editOn} />
          </div>
        </div>
      </div>

      {/* AI dock */}
      <div style={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', background: 'var(--bg-2,#121009)', borderLeft: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
          <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 14, fontWeight: 700, color: 'var(--ink,#f4efe9)' }}>✦ AI Editor</div>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)', marginTop: 2 }}>Describe the vibe — changes apply live</div>
        </div>
        {msgs.length === 0 && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.3)', marginBottom: 8 }}>Try these</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Intimate jazz club', 'Warehouse rave', 'Teal & dark', 'Industrial vibe', 'Serif & elegant', 'Rooftop lounge'].map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'rgba(244,239,233,.6)', fontFamily: 'var(--f-m,monospace)', fontSize: 10, cursor: 'pointer' }}>
                  &quot;{s}&quot;
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.side === 'me' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.side === 'ai' ? 'rgba(34,229,212,.15)' : 'rgba(255,255,255,.08)', fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 800, color: m.side === 'ai' ? '#22e5d4' : 'rgba(244,239,233,.6)' }}>
                {m.side === 'ai' ? '✦' : initials.slice(0, 2)}
              </div>
              <div style={{ maxWidth: '80%', padding: '8px 11px', borderRadius: m.side === 'ai' ? '4px 12px 12px 12px' : '12px 4px 12px 12px', background: m.side === 'ai' ? 'rgba(255,255,255,.05)' : 'rgba(34,229,212,.1)', border: `1px solid ${m.side === 'ai' ? 'rgba(255,255,255,.07)' : 'rgba(34,229,212,.2)'}`, fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink,#f4efe9)' }} dangerouslySetInnerHTML={{ __html: m.html }} />
            </div>
          ))}
          {typing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,229,212,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: '#22e5d4' }}>✦</div>
              <div style={{ padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => <TypingDot key={i} delay={i * 160} />)}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Describe a change…" rows={1} style={{ flex: 1, resize: 'none', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '9px 12px', background: 'rgba(255,255,255,.05)', color: 'var(--ink,#f4efe9)', fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, lineHeight: 1.5, outline: 'none', maxHeight: 120, overflow: 'auto' }} />
            <button onClick={() => send(input)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: input.trim() ? '#22e5d4' : 'rgba(34,229,212,.2)', color: '#0a0805', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinejoin="round" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Venue public page preview ───────────────────────────── */
function VenuePublicPage({ venueName, initials, vars, editOn }: { venueName: string; initials: string; vars: PageVars; editOn: boolean }) {
  const s = vars;
  const hasHero = !!s['--p-hero-url'];
  return (
    <div style={{ background: s['--p-bg'], color: s['--p-ink'], minHeight: '100%', fontFamily: 'system-ui,sans-serif' }}>
      {/* hero */}
      <div style={{ padding: '48px 36px 32px', borderBottom: `1px solid ${s['--p-line']}`, position: 'relative', overflow: 'hidden', ...(hasHero ? { backgroundImage: s['--p-hero-url'], backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }}>
        {hasHero && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,.45) 0%, ${s['--p-bg']}ee 90%)`, zIndex: 0 }} />}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: s['--p-radius'], background: `linear-gradient(135deg,${s['--p-accent']},${s['--p-accent2']})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: s['--p-display'], fontSize: 24, fontWeight: 800, color: '#0a0805', flexShrink: 0 }}>{initials}</div>
          <div>
            <div style={{ fontFamily: s['--p-display'], fontSize: 28, fontWeight: 800, color: hasHero ? '#fff' : s['--p-ink'], lineHeight: 1.1 }} contentEditable={editOn} suppressContentEditableWarning>{venueName}</div>
            <div style={{ fontFamily: 'system-ui', fontSize: 14, color: hasHero ? 'rgba(255,255,255,.65)' : s['--p-ink2'], marginTop: 4 }}>Live Music Venue · Chicago, IL · Cap. 250</div>
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'system-ui', fontSize: 15, color: hasHero ? 'rgba(255,255,255,.8)' : s['--p-ink2'], lineHeight: 1.6, maxWidth: 520 }} contentEditable={editOn} suppressContentEditableWarning>
            Independent music venue in the heart of Chicago. All-ages. Full bar. All genres welcome — curated for the city&apos;s underground scene.
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button style={{ padding: '10px 22px', borderRadius: s['--p-radius'], border: 'none', background: s['--p-accent'], color: '#0a0805', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Follow</button>
            <button style={{ padding: '10px 22px', borderRadius: s['--p-radius'], border: `1px solid ${s['--p-accent']}`, background: 'transparent', color: s['--p-accent'], fontSize: 14, cursor: 'pointer' }}>Book an event</button>
          </div>
        </div>
      </div>
      {/* upcoming shows */}
      <div style={{ padding: '28px 36px', borderBottom: `1px solid ${s['--p-line']}` }}>
        <div style={{ fontFamily: s['--p-display'], fontSize: 20, fontWeight: 800, color: s['--p-ink'], marginBottom: 16 }}>Upcoming Shows</div>
        {[{ date: 'Jun 15', name: 'Jordan Nore', note: 'Alt-R&B · doors 8pm · $15' }, { date: 'Jun 22', name: 'The Veldt Kids', note: 'Post-Punk · doors 9pm · $18' }, { date: 'Jun 28', name: 'Night Transit', note: 'Shoegaze · doors 8pm · $12' }].map(show => (
          <div key={show.date} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: `1px solid ${s['--p-line']}` }}>
            <div style={{ width: 44, fontFamily: 'system-ui', fontSize: 13, fontWeight: 700, color: s['--p-accent'] }}>{show.date}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'system-ui', fontSize: 14, fontWeight: 600, color: s['--p-ink'] }}>{show.name}</div>
              <div style={{ fontFamily: 'system-ui', fontSize: 12, color: s['--p-ink2'] }}>{show.note}</div>
            </div>
            <button style={{ padding: '7px 16px', borderRadius: s['--p-radius'], border: `1px solid ${s['--p-accent']}`, background: 'transparent', color: s['--p-accent'], fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Tickets</button>
          </div>
        ))}
      </div>
      {/* booking inquiry */}
      <div style={{ padding: '28px 36px' }}>
        <div style={{ fontFamily: s['--p-display'], fontSize: 20, fontWeight: 800, color: s['--p-ink'], marginBottom: 8 }}>Book This Venue</div>
        <div style={{ fontFamily: 'system-ui', fontSize: 14, color: s['--p-ink2'], marginBottom: 18 }}>Artists and promoters — send a booking inquiry.</div>
        <div style={{ background: s['--p-surface'], borderRadius: s['--p-radius'], padding: '20px 22px', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Your name', 'Email', 'Proposed date', 'Genre / draw estimate'].map(ph => (
            <input key={ph} placeholder={ph} readOnly style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${s['--p-line']}`, background: 'transparent', color: s['--p-ink2'], fontFamily: 'system-ui', fontSize: 13, outline: 'none' }} />
          ))}
          <button style={{ padding: '11px', borderRadius: 8, border: 'none', background: s['--p-accent'], color: '#0a0805', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Send Inquiry</button>
        </div>
      </div>
    </div>
  );
}

/* ── Gallery ─────────────────────────────────────────────── */
function GalleryPanel() {
  const [videoUrl, setVideoUrl] = useState('');
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 4 }}>Gallery</h2>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)' }}>Photos and video shown on your public page</div>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(34,229,212,.3)', background: 'rgba(34,229,212,.08)', color: '#22e5d4', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '.06em' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" /></svg>
            UPLOAD PHOTO
          </button>
        </div>

        {/* Photo grid */}
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 14 }}>Press Photos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{
              height: 200, borderRadius: 12, border: '1px dashed rgba(255,255,255,.12)', cursor: 'pointer',
              background: `linear-gradient(135deg, rgba(34,229,212,${0.04 + i * 0.015}), rgba(95,211,138,${0.04 + i * 0.015}))`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(244,239,233,.2)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.25)', letterSpacing: '.06em' }}>Add photo</span>
            </div>
          ))}
        </div>

        {/* Feature video */}
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(244,239,233,.4)', marginBottom: 14 }}>Feature Video</div>
        <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 14, padding: '22px 26px' }}>
          <div style={{ height: 160, borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px dashed rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            {videoUrl ? (
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: '#22e5d4' }}>Video linked ✓</div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>▶</div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)' }}>No video yet</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input style={{ ...INPUT_STYLE, flex: 1 }} placeholder="YouTube or Vimeo URL" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
            <button style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: videoUrl ? '#22e5d4' : 'rgba(34,229,212,.2)', color: '#0a0805', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-components ───────────────────────────────── */
function KpiCard({ label, value, delta, color }: { label: string; value: string; delta: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 28, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, color: '#22e5d4' }}>{delta}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 15, fontWeight: 700, color: 'var(--ink,#f4efe9)' }}>{title}</div>
        {subtitle && <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.35)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function SparkLine({ color }: { color: string }) {
  const pts = [40,55,48,72,68,90,85,110,95,120,105,130,115,140,125,155,140,170,145,180,160,190,175,200,185,210,195,220,205,230];
  const max = Math.max(...pts); const h = 80; const w = 600;
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 10}`} style={{ width: '100%', height: 90 }}>
      <defs><linearGradient id="vspkl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={d + ` L${w},${h} L0,${h} Z`} fill="url(#vspkl)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Icons ───────────────────────────────────────────────── */
function IconOverview() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20h18M8 16V8M12 16V4M16 16v-6" strokeLinecap="round" /></svg>; }
function IconShows()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" /></svg>; }
function IconBookings() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .91h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>; }
function IconPageAI()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>; }
function IconGallery()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
