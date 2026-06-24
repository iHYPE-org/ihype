'use client';

import { useState } from 'react';
import type { Metadata } from 'next';

const SHOWS = [
  {
    id: 1, title: 'Alex Rivera @ The Fillmore', status: 'published',
    date: 'Friday, July 4, 2026 · 9:00 PM', city: 'San Francisco',
    ticketsSold: 342, gross: '$8.5k', share: '$3.8k', capacity: null, price: null,
  },
  {
    id: 2, title: 'Alex Rivera @ Monarch', status: 'draft',
    date: 'Saturday, July 12, 2026 · 8:30 PM', city: 'Oakland',
    ticketsSold: null, gross: null, share: null, capacity: 200, price: '$20',
  },
];

const DEMAND = [
  { city: 'San Francisco', pct: 38, hypes: '1,247' },
  { city: 'Oakland', pct: 28, hypes: '912' },
  { city: 'Berkeley', pct: 18, hypes: '587' },
  { city: 'LA', pct: 10, hypes: '326' },
  { city: 'NYC', pct: 4, hypes: '130' },
  { city: 'Portland', pct: 2, hypes: '65' },
];

const PAYOUTS = [
  { title: 'Alex Rivera @ The Fillmore', meta: 'Event ended June 28 · Payout received July 1', amount: '+$3.2k' },
  { title: 'Alex Rivera @ Monarch', meta: 'Event ended June 21 · Payout received June 24', amount: '+$2.8k' },
];

type Tab = 'overview' | 'shows' | 'demand' | 'earnings';

function StepBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= step ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
        }} />
      ))}
    </div>
  );
}

function EventCreatorModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [datetime, setDatetime] = useState('');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState('500');
  const [price, setPrice] = useState('25');

  const artistSplit = (parseFloat(price || '0') * 0.45).toFixed(2);
  const venueSplit = (parseFloat(price || '0') * 0.45).toFixed(2);
  const promoterSplit = (parseFloat(price || '0') * 0.10).toFixed(2);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)', fontSize: 14,
    fontFamily: 'var(--font-body)', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: 40, maxWidth: 500, width: '90%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>Create New Show</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 24, cursor: 'pointer' }}>✕</button>
        </div>

        <StepBar step={step} />

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
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: 12, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Next</button>
              <button onClick={onClose} style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'var(--ink)', cursor: 'pointer' }}>Cancel</button>
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
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'var(--ink)', cursor: 'pointer' }}>Back</button>
              <button onClick={() => setStep(3)} style={{ flex: 1, padding: 12, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Next</button>
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
              <input type="number" style={inputStyle} value={price} onChange={e => setPrice(e.target.value)} />
            </div>
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
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'var(--ink)', cursor: 'pointer' }}>Back</button>
              <button onClick={() => setStep(4)} style={{ flex: 1, padding: 12, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Review</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 16, background: 'var(--bg)', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Preview</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{title || 'Your Show Title'}</h3>
              <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.7)', marginBottom: 12 }}>{datetime || 'TBA'} · {capacity} capacity · ${price}/ticket</p>
              <p style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>✓ Split is locked once published and cannot be changed</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'var(--ink)', cursor: 'pointer' }}>Back</button>
              <button onClick={onClose} style={{ flex: 1, padding: 12, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Publish Show</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudioPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [showModal, setShowModal] = useState(false);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '12px 0',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
    cursor: 'pointer',
    fontWeight: 500,
    color: tab === t ? 'var(--ink)' : 'rgba(240,235,229,0.7)',
    background: 'none',
    fontSize: 14,
    transition: 'all 150ms',
  });

  const cardStyle: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 24,
    background: 'var(--bg2)',
  };

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
            {[
              { label: 'Shows Created', value: '8', trend: 'Lifetime' },
              { label: 'Tickets Sold', value: '1,247', trend: '+340 this month' },
              { label: 'Gross Revenue', value: '$42.3k', trend: 'This month' },
              { label: 'Artist Share (45%)', value: '$19.0k', trend: 'Pending payout' },
            ].map(s => (
              <div key={s.label} style={cardStyle}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>{s.trend}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginTop: 48, marginBottom: 16 }}>Next Event: Live Split</h2>
          <div style={cardStyle}>
            <p style={{ fontSize: 14, marginBottom: 12, color: 'rgba(240,235,229,0.7)' }}>Alex Rivera @ The Fillmore · Friday, July 4</p>
            <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.6)', marginBottom: 16 }}>Ticket Price: <strong>$25.00</strong></p>
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(255,80,41,0.15)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)', marginBottom: 4 }}>Artist</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>$11.25</div>
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--accent)' }}>45%</div>
              </div>
              <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(34,229,212,0.15)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--venue)', marginBottom: 4 }}>Venue</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--venue)' }}>$11.25</div>
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--venue)' }}>45%</div>
              </div>
              <div style={{ flex: 1, padding: 16, textAlign: 'center', background: 'rgba(185,131,255,0.15)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--fan)', marginBottom: 4 }}>Promoters</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fan)' }}>$2.50</div>
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--fan)' }}>10%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'shows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SHOWS.map(show => (
            <div key={show.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>{show.title}</h3>
                  <span style={{
                    display: 'inline-block', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                    background: show.status === 'published' ? 'rgba(34,229,212,0.2)' : 'rgba(255,80,41,0.2)',
                    color: show.status === 'published' ? 'var(--venue)' : 'var(--accent)',
                  }}>
                    {show.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.7)' }}>{show.date} · {show.city}</p>
                <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                  {show.ticketsSold !== null && (
                    <>
                      <div><div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Tickets Sold</div><div style={{ fontSize: 16, fontWeight: 700 }}>{show.ticketsSold}</div></div>
                      <div><div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Gross</div><div style={{ fontSize: 16, fontWeight: 700 }}>{show.gross}</div></div>
                      <div><div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Your Share</div><div style={{ fontSize: 16, fontWeight: 700 }}>{show.share}</div></div>
                    </>
                  )}
                  {show.capacity !== null && (
                    <>
                      <div><div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Capacity</div><div style={{ fontSize: 16, fontWeight: 700 }}>{show.capacity}</div></div>
                      <div><div style={{ fontSize: 11, color: 'rgba(240,235,229,0.6)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Price</div><div style={{ fontSize: 16, fontWeight: 700 }}>{show.price}</div></div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '8px 12px', background: 'rgba(255,80,41,0.2)', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                <button style={{ padding: '8px 12px', background: 'rgba(255,80,41,0.2)', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  {show.status === 'draft' ? 'Publish' : 'View'}
                </button>
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
            {[
              { label: 'Total Earned (45%)', value: '$19.0k', trend: 'Lifetime' },
              { label: 'Pending Payout', value: '$3.8k', trend: 'From last 3 shows' },
              { label: 'Paid Out', value: '$15.2k', trend: '4 payouts received' },
              { label: 'Next Settlement', value: 'July 15', trend: 'After event closes' },
            ].map(s => (
              <div key={s.label} style={cardStyle}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.6)', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.6)', marginTop: 4 }}>{s.trend}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginTop: 48, marginBottom: 16 }}>Payout History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PAYOUTS.map(p => (
              <div key={p.title} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(240,235,229,0.7)' }}>{p.meta}</p>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{p.amount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && <EventCreatorModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
