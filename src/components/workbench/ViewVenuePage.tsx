'use client';

import React, { useState, useEffect } from 'react';
import { WorkbenchData, WbVenueRequest } from '@/types/workbench';
import ViewPageStudio from './ViewPageStudio';

/* ── types ───────────────────────────────────────────────── */
type VenueMode = 'overview' | 'shows' | 'bookings' | 'insights' | 'tools' | 'page' | 'gallery';

/* ── helpers ─────────────────────────────────────────────── */
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
    { k: 'insights',  label: 'Insights',  icon: <IconInsights /> },
    { k: 'tools',     label: 'Tools',     icon: <IconTools /> },
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
          <RailBtn active={mode === 'insights'}  onClick={() => setMode('insights')}  label="Insights"  icon={<IconInsights />} />
          <RailBtn active={mode === 'tools'}     onClick={() => setMode('tools')}     label="Tools"     icon={<IconTools />} />
          <RailBtn active={mode === 'page'}      onClick={() => setMode('page')}      label="Page + AI" icon={<IconPageAI />} />
          <RailBtn active={mode === 'gallery'}   onClick={() => setMode('gallery')}   label="Gallery"   icon={<IconGallery />} />
        </div>

        {/* health bar */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line-2,rgba(255,255,255,.07))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,239,233,.35)' }}>Calendar fill</span>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, fontWeight: 700, color: '#ffb84a' }}>71%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '71%', background: 'linear-gradient(90deg,#ffb84a,#ff5029)', borderRadius: 99 }} />
          </div>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.35)', marginTop: 6 }}>9 open nights this month</div>
        </div>
      </div>

      {/* ── stage ── */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingBottom: isMobile ? 58 : 0, boxSizing: 'border-box' }}>
        {mode === 'overview'  && <OverviewPanel data={data} />}
        {mode === 'shows'     && <ShowsPanel venueName={venueName} />}
        {mode === 'bookings'  && <BookingsPanel data={data} />}
        {mode === 'insights'  && <InsightsPanel />}
        {mode === 'tools'     && <VenueToolsPanel />}
        {mode === 'page'      && <ViewPageStudio data={data} />}
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
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Overview</h2>
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 28 }}>Last 30 days · updated hourly</div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
          <KpiCard label="HYPE Count" value={(data.lifeStats?.totalHype ?? 0).toLocaleString()} delta="" color="#ff5029" />
          <KpiCard label="Followers" value={(data.followerCount ?? 0).toLocaleString()} delta="" color="#ff3e9a" />
          <KpiCard label="Booking Requests" value={(data.pendingVenueRequestCount ?? 0).toString()} delta={`${data.pendingVenueRequestCount ?? 0} pending`} color="#22e5d4" />
        </div>

        {/* Hype activity chart */}
        <SectionCard title="Hype Activity" subtitle="Daily hypes over the past 30 days">
          <SparkLine color="#22e5d4" profileId={data.profileId} />
        </SectionCard>

        {/* Audience */}
        <SectionCard title="Audience" subtitle="Followers on iHYPE">
          <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 32, fontWeight: 800, color: 'var(--ink,#f4efe9)', lineHeight: 1 }}>
            {(data.followerCount ?? 0).toLocaleString()}
          </div>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginTop: 6 }}>total followers</div>
        </SectionCard>

        {/* Recent Activity */}
        <SectionCard title="Recent Activity" subtitle="">
          <div>
            {(data.activity ?? []).length === 0 ? (
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.3)', padding: '12px 0' }}>No recent activity</div>
            ) : (data.activity ?? []).slice(0, 5).map((a, i, arr) => {
              const dotColors: Record<string, string> = { hype: '#ff3e9a', show: '#22e5d4', radio: '#b983ff', payout: '#ffb84a' };
              const color = dotColors[a.kind] ?? '#22e5d4';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.7)' }}>{a.text}</div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', flexShrink: 0 }}>{a.time}</div>
                </div>
              );
            })}
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
  const [showErr, setShowErr] = useState('');
  const [scheduledShows, setScheduledShows] = useState([
    { id: '1', title: 'Jordan Nore', date: `${year}-${String(month + 1).padStart(2, '0')}-15`, time: '9:00 PM', cap: 180, sold: 142, price: 15 },
    { id: '2', title: 'The Veldt Kids', date: `${year}-${String(month + 1).padStart(2, '0')}-22`, time: '9:30 PM', cap: 200, sold: 85, price: 18 },
    { id: '3', title: 'Night Transit', date: `${year}-${String(month + 1).padStart(2, '0')}-28`, time: '8:00 PM', cap: 150, sold: 36, price: 12 },
  ]);

  function addShow(e: React.FormEvent) {
    e.preventDefault();
    if (!showTitle.trim() || !showDate) return;
    const titleNorm = showTitle.trim().toLowerCase();
    const duplicate = scheduledShows.find(s => s.title.toLowerCase() === titleNorm && s.date === showDate);
    if (duplicate) {
      setShowErr(`A show named "${duplicate.title}" is already scheduled on ${showDate}.`);
      return;
    }
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
    setShowTitle(''); setShowDate(''); setShowArtist(''); setShowPrice(''); setShowCap(''); setShowErr('');
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
              <input style={INPUT_STYLE} placeholder="Show / event title *" value={showTitle} onChange={e => { setShowTitle(e.target.value); setShowErr(''); }} required />
              <input style={INPUT_STYLE} placeholder="Headliner / artist name" value={showArtist} onChange={e => setShowArtist(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5 }}>DATE *</div>
                  <input type="date" style={INPUT_STYLE} value={showDate} onChange={e => { setShowDate(e.target.value); setShowErr(''); }} required />
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
            {showErr && <div style={{ color: '#ff5029', fontFamily: 'var(--f-m,monospace)', fontSize: 12, marginTop: 8 }}>{showErr}</div>}
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
function BookingsPanel({ data }: { data: WorkbenchData }) {
  const [requests, setRequests] = useState<WbVenueRequest[]>(data.venueRequests ?? []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ artist: '', date: '', offer: '', message: '' });
  const [sent, setSent] = useState(false);

  async function accept(id: string) {
    await fetch(`/api/venue-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'BOOKED' }),
    });
    setRequests(rs => rs.map(r => r.id === id ? { ...r, status: 'BOOKED' } : r));
  }
  async function decline(id: string) {
    await fetch(`/api/venue-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISMISSED' }),
    });
    setRequests(rs => rs.map(r => r.id === id ? { ...r, status: 'DISMISSED' } : r));
  }

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
          {requests.length === 0 && (
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.3)', padding: '20px 0' }}>No booking requests yet</div>
          )}
          {requests.map(r => {
            const status = r.status;
            const isExp = expanded === r.id;
            return (
              <div key={r.id} style={{
                background: status === 'DISMISSED' ? 'rgba(255,255,255,.02)' : 'var(--bg-2,#121009)',
                border: `1px solid ${status === 'BOOKED' ? 'rgba(34,229,212,.25)' : status === 'DISMISSED' ? 'rgba(255,255,255,.05)' : 'var(--line-2,rgba(255,255,255,.07))'}`,
                borderRadius: 12, overflow: 'hidden',
                opacity: status === 'DISMISSED' ? 0.55 : 1,
                transition: 'all .2s',
              }}>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 15, fontWeight: 700, color: status === 'DISMISSED' ? 'rgba(244,239,233,.4)' : 'var(--ink,#f4efe9)', marginBottom: 2 }}>{r.artistName}</div>
                        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.4)' }}>{r.requesterType}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {status === 'BOOKED' && <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, color: '#22e5d4', background: 'rgba(34,229,212,.1)', border: '1px solid rgba(34,229,212,.25)', padding: '3px 8px', borderRadius: 99 }}>Accepted</span>}
                      {status === 'DISMISSED' && <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', padding: '3px 8px' }}>Declined</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setExpanded(isExp ? null : r.id)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', background: 'transparent', border: '1px solid var(--line-2,rgba(255,255,255,.1))', color: 'var(--ink-2,rgba(244,239,233,.6))' }}
                    >
                      {isExp ? 'Hide message' : 'View request'}
                    </button>
                    {status === 'PENDING' && (
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
                    {r.note
                      ? <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.65)', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.note}"</div>
                      : <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.3)' }}>No message provided</div>
                    }
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

function SparkLine({ color, profileId }: { color: string; profileId?: string }) {
  const [pts, setPts] = React.useState<number[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!profileId) { setLoaded(true); return; }
    fetch(`/api/hype/chart?profileId=${profileId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { days: { date: string; count: number }[] } | null) => {
        if (d?.days) setPts(d.days.map(x => x.count));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [profileId]);

  const data = pts.length > 0 ? pts : Array(30).fill(0);
  const max = Math.max(...data, 1);
  const h = 80; const w = 600;
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  if (!loaded) return <div style={{ height: 90, background: 'rgba(255,255,255,.03)', borderRadius: 6 }} />;
  return (
    <svg viewBox={`0 0 ${w} ${h + 10}`} style={{ width: '100%', height: 90 }}>
      <defs><linearGradient id="vspkl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={d + ` L${w},${h} L0,${h} Z`} fill="url(#vspkl)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Insights panel ──────────────────────────────────────── */
function InsightsPanel() {
  const revMix = [
    { label: 'Ticket sales', pct: 45, color: '#22e5d4' },
    { label: 'Venue share (45%)', pct: 45, color: '#5fd38a' },
    { label: 'Referrer fees (10%)', pct: 10, color: '#b983ff' },
  ];
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];
  const fill = [62, 55, 78, 71, 83, 71];
  const maxFill = Math.max(...fill);

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Insights</h2>
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 28 }}>Revenue mix · Calendar fill · Audience</div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
          <KpiCard label="Avg Ticket Rev" value="$1,840" delta="per show" color="#22e5d4" />
          <KpiCard label="Repeat Buyers" value="38%" delta="+6% vs last mo" color="#5fd38a" />
          <KpiCard label="Calendar Fill" value="71%" delta="9 open nights" color="#ffb84a" />
          <KpiCard label="Sell-through" value="81%" delta="avg across shows" color="#b983ff" />
        </div>

        {/* Revenue mix */}
        <SectionCard title="Revenue mix" subtitle="How your ticket revenue is split per iHYPE's 45/45/10 model">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {revMix.map(r => (
              <div key={r.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.7)' }}>{r.label}</span>
                  <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, color: r.color }}>{r.pct}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', lineHeight: 1.55 }}>
              $0 platform fee — iHYPE keeps nothing from ticket sales.
            </div>
          </div>
        </SectionCard>

        {/* Calendar fill bar chart */}
        <SectionCard title="Calendar fill" subtitle="Booked nights as % of available nights per month">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
            {months.map((m, i) => (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: i === months.length - 1 ? '#ffb84a' : 'rgba(244,239,233,.5)', fontWeight: i === months.length - 1 ? 700 : 400 }}>{fill[i]}%</div>
                <div style={{ width: '100%', background: 'rgba(255,255,255,.05)', borderRadius: 4, overflow: 'hidden', height: 60, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${(fill[i] / maxFill) * 100}%`, background: i === months.length - 1 ? '#ffb84a' : '#22e5d4', borderRadius: '4px 4px 0 0', opacity: i === months.length - 1 ? 1 : 0.5 }} />
                </div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)' }}>{m}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Repeat buyers */}
        <SectionCard title="Repeat buyers" subtitle="Fans who bought tickets to more than one show at your venue">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 42, fontWeight: 800, letterSpacing: '-.03em', color: '#5fd38a', lineHeight: 1 }}>38%</div>
              <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginTop: 6 }}>of all ticket buyers</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.65)', lineHeight: 1.6 }}>
                Fans who return spend 2.4× more per visit on avg. Repeat rate above 35% suggests strong venue loyalty.
              </div>
              <div style={{ marginTop: 10, fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: '#5fd38a' }}>+6% vs last month ↑</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Venue Tools (backline / rider / specs) ──────────────── */
function VenueToolsPanel() {
  const [saved, setSaved] = useState(false);
  const [spec, setSpec] = useState({
    stageDims: "20' × 16' · 24\" riser",
    pa: 'd&b · 4 monitor mixes',
    backline: 'House drum kit · DI boxes on request',
    loadIn: 'Alley door · available from 4PM',
    green: 'Ground floor · wifi · fridge',
  });
  const [rider, setRider] = useState('Standard hospitality rider:\n- 2× cases of water\n- 1× case of beer (domestic OK)\n- Hot meal for 4 (can be catered or per-diem $20/head)');
  const [offer, setOffer] = useState({ base: '400', door: '70', guarantee: false, notes: '' });
  const [aiOffer, setAiOffer] = useState('');
  const [generating, setGenerating] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function generateOffer() {
    setGenerating(true);
    setTimeout(() => {
      setAiOffer(`Based on your 220-cap room, a ${offer.guarantee ? 'guaranteed' : 'door-deal'} offer of $${offer.base} flat + ${offer.door}% of door after expenses is within the Chicago indie market range for a mid-tier regional draw. For a first booking, consider adding a $50 hotel contribution to close faster.`);
      setGenerating(false);
    }, 1200);
  }

  const fieldStyle: React.CSSProperties = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, color: 'var(--ink,#f4efe9)', fontFamily: 'var(--f-b,sans-serif)',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', marginBottom: 6 }}>Venue Tools</h2>
        <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginBottom: 28 }}>Tech specs · Rider · Offer builder</div>

        <form onSubmit={save}>
          {/* Backline / tech spec */}
          <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '22px 26px', marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'rgba(244,239,233,.4)', marginBottom: 18 }}>House &amp; Tech Specs</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {([
                ['Stage dimensions', 'stageDims'],
                ['PA system', 'pa'],
                ['Backline available', 'backline'],
                ['Load-in', 'loadIn'],
                ['Green room', 'green'],
              ] as [string, keyof typeof spec][]).map(([label, key]) => (
                <div key={key}>
                  <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5, letterSpacing: '.06em', textTransform: 'uppercase' as const }}>{label}</div>
                  <input style={fieldStyle} value={spec[key]} onChange={e => setSpec(s => ({ ...s, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Hospitality rider */}
          <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '22px 26px', marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'rgba(244,239,233,.4)', marginBottom: 14 }}>Hospitality Rider</div>
            <textarea style={{ ...fieldStyle, minHeight: 100, resize: 'vertical' as const, fontFamily: 'var(--f-b,sans-serif)' }} value={rider} onChange={e => setRider(e.target.value)} />
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, color: 'rgba(244,239,233,.3)', marginTop: 8 }}>This will appear on your booking confirmation page for artists.</div>
          </div>

          {/* AI offer builder */}
          <div style={{ background: 'var(--bg-2,#121009)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '22px 26px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'rgba(244,239,233,.4)', marginBottom: 14 }}>AI Offer Builder</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5, letterSpacing: '.06em', textTransform: 'uppercase' as const }}>Base offer ($)</div>
                <input style={fieldStyle} type="number" min="0" value={offer.base} onChange={e => setOffer(o => ({ ...o, base: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.4)', marginBottom: 5, letterSpacing: '.06em', textTransform: 'uppercase' as const }}>Door %</div>
                <input style={fieldStyle} type="number" min="0" max="100" value={offer.door} onChange={e => setOffer(o => ({ ...o, door: e.target.value }))} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.6)', cursor: 'pointer', marginBottom: 12 }}>
              <input type="checkbox" checked={offer.guarantee} onChange={e => setOffer(o => ({ ...o, guarantee: e.target.checked }))} style={{ width: 15, height: 15 }} />
              Guarantee (no door split)
            </label>
            <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' as const, marginBottom: 12 }} placeholder="Any notes for the artist (load-in window, parking, etc.)…" value={offer.notes} onChange={e => setOffer(o => ({ ...o, notes: e.target.value }))} />
            <button type="button" onClick={generateOffer} disabled={generating}
              style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid rgba(185,131,255,.35)', cursor: generating ? 'wait' : 'pointer', background: 'rgba(185,131,255,.15)', color: '#b983ff', fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, letterSpacing: '.04em' } as React.CSSProperties}>
              {generating ? '✦ Thinking…' : '✦ AI — draft offer summary'}
            </button>
            {aiOffer && (
              <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(185,131,255,.06)', border: '1px solid rgba(185,131,255,.2)', fontFamily: 'var(--f-b,sans-serif)', fontSize: 13, color: 'rgba(244,239,233,.75)', lineHeight: 1.65 }}>
                {aiOffer}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={{ padding: '11px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#22e5d4', color: '#0a0805', fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em' }}>
              {saved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────── */
function IconInsights() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20h18M6 14l4-6 4 4 4-8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconTools()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconOverview() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20h18M8 16V8M12 16V4M16 16v-6" strokeLinecap="round" /></svg>; }
function IconShows()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" /></svg>; }
function IconBookings() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .91h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>; }
function IconPageAI()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>; }
function IconGallery()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
