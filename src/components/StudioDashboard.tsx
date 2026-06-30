'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ApiShow {
  id: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED';
  isTicketed: boolean;
  isRadioShow: boolean;
  ticketsSoldCount: number;
  ticketPriceCents: number | null;
  ticketCapacity: number | null;
  artistPayoutPercent: number | null;
  venuePayoutPercent: number | null;
  promoterPayoutPercent: number | null;
  startsAt: string | null;
  venueProfile: { name: string; city: string | null } | null;
  headlinerProfile: { name: string } | null;
  createdAt: string;
}

const DEMAND = [
  { city: 'San Francisco', pct: 38, hypes: '1,247' },
  { city: 'Oakland', pct: 28, hypes: '912' },
  { city: 'Berkeley', pct: 18, hypes: '587' },
  { city: 'LA', pct: 10, hypes: '326' },
  { city: 'NYC', pct: 4, hypes: '130' },
  { city: 'Portland', pct: 2, hypes: '65' },
];

type Tab = 'overview' | 'shows' | 'demand' | 'earnings';

function fmt$(cents: number) {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`;
  if (cents >= 1000) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return 'TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StepBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'rgba(255,255,255,0.1)' }} />
      ))}
    </div>
  );
}

function EventCreatorModal({ onClose, onCreated }: { onClose: () => void; onCreated: (show: ApiShow) => void }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [datetime, setDatetime] = useState('');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState('500');
  const [price, setPrice] = useState('25');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceDollars = parseFloat(price || '0');
  const artistSplit = (priceDollars * 0.45).toFixed(2);
  const venueSplit = (priceDollars * 0.45).toFixed(2);
  const promoterSplit = (priceDollars * 0.10).toFixed(2);

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'New Show',
          status: 'SCHEDULED',
          startsAt: datetime ? new Date(datetime).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
          isTicketed: priceDollars > 0,
          ticketPriceCents: Math.round(priceDollars * 100),
          ticketCapacity: parseInt(capacity, 10) || 500,
          venuePayoutPercent: 45,
          artistPayoutPercent: 45,
          promoterPayoutPercent: 10,
          tags: genre ? [genre.toLowerCase().replace(/\s+/g, '-')] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create show'); setSubmitting(false); return; }
      onCreated(data as ApiShow);
      onClose();
    } catch {
      setError('Network error — please try again');
    }
    setSubmitting(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)', fontSize: 14,
    fontFamily: 'var(--font-body)', boxSizing: 'border-box',
  };
  const btnPrimary: React.CSSProperties = { flex: 1, padding: 12, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, fontSize: 14 };
  const btnGhost: React.CSSProperties = { flex: 1, padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'var(--ink)', cursor: 'pointer', fontSize: 14 };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, maxWidth: 500, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>Create New Show</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 24, cursor: 'pointer' }}>✕</button>
        </div>
        <StepBar step={step} />
        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,80,41,0.12)', border: '1px solid rgba(255,80,41,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--accent)' }}>{error}</div>}

        {step === 1 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Show Title</label>
              <input style={inputStyle} placeholder="e.g. Alex Rivera @ The Fillmore" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Genre</label>
              <input style={inputStyle} placeholder="e.g. Deep House, Tech House" value={genre} onChange={e => setGenre(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={btnPrimary} disabled={!title.trim()}>Next</button>
              <button onClick={onClose} style={btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Date &amp; Time</label>
              <input type="datetime-local" style={inputStyle} value={datetime} onChange={e => setDatetime(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Venue</label>
              <input style={inputStyle} placeholder="e.g. The Fillmore, San Francisco" value={venue} onChange={e => setVenue(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={btnGhost}>Back</button>
              <button onClick={() => setStep(3)} style={btnPrimary}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Capacity</label>
              <input type="number" style={inputStyle} value={capacity} onChange={e => setCapacity(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Ticket Price ($)</label>
              <input type="number" style={inputStyle} value={price} onChange={e => setPrice(e.target.value)} min="0" />
            </div>
            {priceDollars > 0 && (
              <>
                <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.7)', marginBottom: 12 }}>Live Split Calculation</p>
                <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(255,80,41,0.15)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4, color: 'var(--accent)' }}>Artist (45%)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>${artistSplit}</div>
                  </div>
                  <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(34,229,212,0.15)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4, color: 'var(--venue)' }}>Venue (45%)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--venue)' }}>${venueSplit}</div>
                  </div>
                  <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(185,131,255,0.15)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4, color: 'var(--fan)' }}>Promoters (10%)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fan)' }}>${promoterSplit}</div>
                  </div>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={btnGhost}>Back</button>
              <button onClick={() => setStep(4)} style={btnPrimary}>Review</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 16, background: 'var(--bg)', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Preview</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{title || 'Your Show'}</h3>
              <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.7)', marginBottom: 12 }}>{datetime ? fmtDate(datetime) : 'TBA'} · {capacity} capacity{priceDollars > 0 ? ` · $${price}/ticket` : ' · Free'}</p>
              <p style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>✓ Split is locked once published and cannot be changed</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(3)} style={btnGhost}>Back</button>
              <button onClick={publish} style={btnPrimary} disabled={submitting}>{submitting ? 'Publishing…' : 'Publish Show'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function StudioDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [showModal, setShowModal] = useState(false);
  const [shows, setShows] = useState<ApiShow[]>([]);
  const [loadingShows, setLoadingShows] = useState(true);

  useEffect(() => {
    fetch('/api/shows?mine=1')
      .then(r => r.ok ? r.json() : [])
      .then((data: ApiShow[]) => setShows(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingShows(false));
  }, []);

  const ticketedShows = shows.filter(s => s.isTicketed);
  const totalTicketsSold = ticketedShows.reduce((a, s) => a + s.ticketsSoldCount, 0);
  const totalGrossCents = ticketedShows.reduce((a, s) => a + s.ticketsSoldCount * (s.ticketPriceCents ?? 0), 0);
  const artistShareCents = ticketedShows.reduce((a, s) => a + s.ticketsSoldCount * (s.ticketPriceCents ?? 0) * ((s.artistPayoutPercent ?? 45) / 100), 0);

  const cardStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 24, background: 'var(--bg2)' };

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '12px 0', cursor: 'pointer', fontWeight: 500, fontSize: 14, transition: 'all 150ms',
    color: tab === t ? 'var(--ink)' : 'rgba(240,235,229,0.7)', background: 'none',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
  });

  async function updateShowStatus(showId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/shows/${showId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const { show: updated } = await res.json();
        setShows(prev => prev.map(s => s.id === updated.id ? { ...s, status: updated.status } : s));
      }
    } catch { /* silent */ }
  }

  function statusBadge(s: ApiShow) {
    const map: Record<string, [string, string]> = {
      LIVE: ['rgba(34,229,212,0.2)', 'var(--venue)'],
      SCHEDULED: ['rgba(34,229,212,0.2)', 'var(--venue)'],
      DRAFT: ['rgba(255,80,41,0.2)', 'var(--accent)'],
      ENDED: ['rgba(255,255,255,0.08)', 'rgba(240,235,229,0.5)'],
    };
    const [bg, color] = map[s.status] ?? map.ENDED;
    const label = s.status === 'SCHEDULED' ? 'Published' : s.status;
    return <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: bg, color }}>{label}</span>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 100px' }}>
      <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>Creator Studio</h1>
          <p style={{ fontSize: 14, color: 'rgba(240,235,229,0.7)' }}>Manage shows, track demand, and monitor earnings</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '12px 24px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          + New Show
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 32 }}>
        {(['overview', 'shows', 'demand', 'earnings'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === 'overview' ? 'Overview' : t === 'shows' ? 'Shows' : t === 'demand' ? 'Demand Radar' : 'Earnings'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            <div style={cardStyle}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>Shows Created</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{loadingShows ? '–' : shows.length}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>Lifetime</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>Tickets Sold</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{loadingShows ? '–' : totalTicketsSold.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>Across all ticketed shows</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>Gross Revenue</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{loadingShows ? '–' : fmt$(totalGrossCents)}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>All time</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>Your Share (45%)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{loadingShows ? '–' : fmt$(artistShareCents)}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>Artist / Creator cut</div>
            </div>
          </div>

          {/* Quick links to growth surfaces */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 24 }}>
            {[
              { href: '/me/wrapped', label: 'My Scene', desc: 'Your month, shareable', color: '#b983ff' },
              { href: '/me/promote', label: 'Share & Earn', desc: 'Promote shows, earn', color: '#ff3e9a' },
              { href: '/me/booking', label: 'Book Artists', desc: 'Your demand radar', color: '#22e5d4' },
              { href: '/radio/station', label: 'Station', desc: 'Always-on radio', color: 'var(--accent)' },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: link.color }}>{link.label} →</div>
                  <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.55)', marginTop: 2 }}>{link.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          {shows.length > 0 && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginTop: 48, marginBottom: 16 }}>Next Show: Live Split</h2>
              {(() => {
                const next = shows.find(s => s.isTicketed && s.ticketPriceCents && s.status !== 'ENDED') ?? shows[0];
                const p = (next.ticketPriceCents ?? 0) / 100;
                return (
                  <div style={cardStyle}>
                    <p style={{ fontSize: 14, marginBottom: 12, color: 'rgba(240,235,229,0.7)' }}>{next.title}{next.venueProfile ? ` · ${next.venueProfile.name}` : ''}</p>
                    <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.6)', marginBottom: 16 }}>
                      Ticket Price: <strong>${p.toFixed(2)}</strong>
                    </p>
                    {p > 0 && (
                      <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(255,80,41,0.15)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)', marginBottom: 4 }}>Artist</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>${(p * 0.45).toFixed(2)}</div>
                          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--accent)' }}>45%</div>
                        </div>
                        <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(34,229,212,0.15)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--venue)', marginBottom: 4 }}>Venue</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--venue)' }}>${(p * 0.45).toFixed(2)}</div>
                          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--venue)' }}>45%</div>
                        </div>
                        <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(185,131,255,0.15)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--fan)', marginBottom: 4 }}>Promoters</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fan)' }}>${(p * 0.10).toFixed(2)}</div>
                          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--fan)' }}>10%</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {tab === 'shows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadingShows && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(240,235,229,0.5)' }}>Loading…</div>}
          {!loadingShows && shows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(240,235,229,0.4)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12 }}>
              <p style={{ marginBottom: 16, fontSize: 15 }}>No shows yet</p>
              <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>+ Create your first show</button>
            </div>
          )}
          {shows.map(show => (
            <div key={show.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>{show.title}</h3>
                  {statusBadge(show)}
                  {show.isRadioShow && <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: 'rgba(185,131,255,0.2)', color: 'var(--fan)' }}>Radio</span>}
                </div>
                <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.7)', marginBottom: 8 }}>
                  {show.startsAt ? fmtDate(show.startsAt) : 'TBA'}{show.venueProfile ? ` · ${show.venueProfile.city || show.venueProfile.name}` : ''}
                </p>
                {show.isTicketed && (
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Tickets Sold</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{show.ticketsSoldCount}{show.ticketCapacity ? ` / ${show.ticketCapacity}` : ''}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Price</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{show.ticketPriceCents ? `$${(show.ticketPriceCents / 100).toFixed(2)}` : '–'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Your Share</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt$(show.ticketsSoldCount * (show.ticketPriceCents ?? 0) * 0.45)}</div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {show.status === 'SCHEDULED' && (
                  <button
                    onClick={() => updateShowStatus(show.id, 'LIVE')}
                    style={{ padding: '8px 12px', background: 'rgba(255,80,41,0.9)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                  >
                    Go Live
                  </button>
                )}
                {show.status === 'LIVE' && (
                  <button
                    onClick={() => updateShowStatus(show.id, 'ENDED')}
                    style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.08)', color: 'rgba(240,235,229,.7)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                  >
                    End Show
                  </button>
                )}
                {show.isTicketed && show.status === 'ENDED' && (
                  <a href={`/payout/${show.slug}`} style={{ padding: '8px 12px', background: 'rgba(34,229,212,0.15)', color: '#22e5d4', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, textDecoration: 'none' }}>Payout →</a>
                )}
                <a href={`/shows/${show.slug}`} style={{ padding: '8px 12px', background: 'rgba(255,80,41,0.15)', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, textDecoration: 'none' }}>View</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'demand' && (
        <div>
          <p style={{ fontSize: 14, color: 'rgba(240,235,229,0.7)', marginBottom: 24 }}>Where fans want to see you play</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {DEMAND.map(d => (
              <div key={d.city} style={{ padding: 16, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, background: 'var(--bg)', textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.city}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{d.pct}%</div>
                <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{d.hypes} hypes</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'earnings' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            <div style={cardStyle}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>Total Earned (45%)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{loadingShows ? '–' : fmt$(artistShareCents)}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>Lifetime</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>Paid Out</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{loadingShows ? '–' : fmt$(artistShareCents)}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>
                {ticketedShows.length > 0
                  ? <a href={`/payout/${ticketedShows[0].slug}`} style={{ color: '#22e5d4', textDecoration: 'none' }}>View payout breakdown →</a>
                  : 'See payout when shows end'}
              </div>
            </div>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginTop: 48, marginBottom: 16 }}>Show History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loadingShows && <div style={{ color: 'rgba(240,235,229,0.5)', fontSize: 14 }}>Loading…</div>}
            {!loadingShows && ticketedShows.length === 0 && (
              <div style={{ color: 'rgba(240,235,229,0.4)', fontSize: 14 }}>No ticketed shows yet</div>
            )}
            {ticketedShows.map(show => {
              const gross = show.ticketsSoldCount * (show.ticketPriceCents ?? 0);
              const artistCut = gross * ((show.artistPayoutPercent ?? 45) / 100);
              return (
                <div key={show.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{show.title}</h3>
                    <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.7)' }}>{show.startsAt ? fmtDate(show.startsAt) : 'TBA'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>+{fmt$(artistCut)}</div>
                    <a href={`/payout/${show.slug}`} style={{ fontSize: 11, color: '#22e5d4', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>BREAKDOWN →</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <EventCreatorModal
          onClose={() => setShowModal(false)}
          onCreated={show => setShows(prev => [show, ...prev])}
        />
      )}
    </div>
  );
}
