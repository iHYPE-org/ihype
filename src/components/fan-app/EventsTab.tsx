'use client';

import { useState, useEffect } from 'react';
import { useApp } from './context';
import { IHYPE_DATA, Show } from '@/lib/data';
import { track } from '@/lib/analytics';

const SOLD_OUT = new Set(['s3']);
const DISTANCES: Record<string, string> = { s1: '0.4 mi', s2: '1.2 mi', s3: '1.8 mi', s4: '0.9 mi' };
const GENRES_F = ['All', 'dream-pop', 'shoegaze', 'lo-fi', 'r&b', 'electronic', 'folk'];

function VBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13, borderRadius: '50%', background: '#5b8cff', marginLeft: 3, flexShrink: 0, verticalAlign: 'middle' }}>
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

const VERIFIED = new Set(['Midnight Echo', 'Nyla', 'DJ Caro', 'Wax Tropic', 'Cold Harbor']);

function CheckoutSheet({ show, onClose, onDone }: { show: Show | null; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState(1);
  if (!show) return null;
  const gross = (show.price * qty).toFixed(2);
  const tm = (show.price * 1.27 * qty).toFixed(2);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-surface)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.03em', marginBottom: 4 }}>{show.artist}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--ink-3)', marginBottom: 18 }}>{show.venue} · {show.date}</div>
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 16 }}>
          <div style={{ flex: 45, background: '#ff5029', borderRadius: '999px 0 0 999px' }} />
          <div style={{ flex: 45, background: '#22e5d4' }} />
          <div style={{ flex: 10, background: '#b983ff', borderRadius: '0 999px 999px 0' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 11, background: 'var(--bg-raised)', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem', color: 'var(--ink-3)' }}>Ticketmaster: ${tm}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#22e5d4' }}>You pay ${gross}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem', color: 'var(--ink-3)' }}>Qty</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>−</button>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => Math.min(4, q + 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>+</button>
          </div>
        </div>
        <button onClick={onDone} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,80,41,.3)' }}>Pay ${gross} · Apple Pay</button>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3)', textAlign: 'center', marginTop: 8 }}>+ $0.00 fees · 45% to artist · locked in charter</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.62rem', color: '#ffb84a', textAlign: 'center', marginTop: 6, opacity: .8 }}>⚠ Beta — simulated purchase, no real charge.</p>
      </div>
    </div>
  );
}

function FilterSheet({ open, filter, onFilter, onClose }: { open: boolean; filter: string; onFilter: (g: string) => void; onClose: () => void }) {
  const [maxPrice, setMaxPrice] = useState(50);
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-surface)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 16 }}>Filter events</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Genre</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {GENRES_F.map(g => {
            const on = filter === g;
            return <button key={g} onClick={() => onFilter(g)} style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: '.78rem', fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{g}</button>;
          })}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Max price: ${maxPrice}</div>
        <input type="range" min={5} max={100} value={maxPrice} onChange={e => setMaxPrice(+e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: 16 }} />
        <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Apply filters</button>
      </div>
    </div>
  );
}

function Skeleton({ h = 120 }: { h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--line)', marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
    </div>
  );
}

function EventCard({ s, onBuy, idx = 0 }: { s: Show; onBuy: (s: Show) => void; idx?: number }) {
  const { openSheet } = useApp();
  const [hyped, setHyped] = useState(false);
  const [liveCount, setLiveCount] = useState(s.hype);
  const soldOut = SOLD_OUT.has(s.id);

  useEffect(() => {
    if (s.status !== 'LIVE') return;
    const t = setInterval(() => setLiveCount(c => c + Math.floor(Math.random() * 3 + 1)), 2800);
    return () => clearInterval(t);
  }, [s.status]);

  return (
    <div style={{ borderRadius: 18, border: '1px solid var(--line)', background: 'var(--bg-surface)', overflow: 'hidden', marginBottom: 12, animation: `fadeIn .3s ${idx * .07}s both` }}>
      <div style={{ height: 100, background: `linear-gradient(135deg,${s.tint}44,${s.tint}11)`, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%,${s.tint}44,transparent 60%)` }} />
        <div style={{ position: 'absolute', bottom: 10, left: 14 }}>
          <div onClick={() => openSheet('artist-profile', { artist: s.artist })} style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'rgba(240,235,229,.95)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
            {s.artist}{VERIFIED.has(s.artist) && <VBadge />}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'rgba(240,235,229,.7)' }}>{s.venue} · {s.city}</div>
        </div>
        {soldOut && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,5,4,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.7)', padding: '5px 14px', borderRadius: 999, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.15)' }}>Sold out</span>
          </div>
        )}
        {s.status === 'LIVE' && !soldOut && (
          <button onClick={e => { e.stopPropagation(); openSheet('live-event', s); }} style={{ position: 'absolute', top: 10, right: 12, fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#ff3c3c', background: 'rgba(255,60,60,.15)', border: '1px solid rgba(255,60,60,.3)', borderRadius: 999, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff3c3c' }} />{liveCount.toLocaleString()} live
          </button>
        )}
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{s.date}</span>
            {DISTANCES[s.id] && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', color: 'var(--ink-3)', padding: '2px 7px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--bg-raised)' }}>{DISTANCES[s.id]}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>${s.price}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: '#22e5d4' }}>+ $0 fees</span>
          </div>
        </div>
        <button onClick={() => setHyped(h => !h)} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${hyped ? 'var(--accent)' : 'var(--line)'}`, background: hyped ? 'rgba(255,80,41,.12)' : 'transparent', color: hyped ? 'var(--accent)' : 'var(--ink-3)', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>{hyped ? '🔥' : '☆'}</button>
        <button title="Share" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
        </button>
        {soldOut
          ? <button style={{ padding: '8px 14px', borderRadius: 999, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: '.78rem', cursor: 'pointer' }}>Join waitlist</button>
          : <button onClick={() => { track('buy_ticket_tap', { show: s.id }); onBuy(s); }} style={{ padding: '8px 18px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.82rem', cursor: 'pointer' }}>Get ticket</button>
        }
      </div>
    </div>
  );
}

function MyTickets({ onBrowse }: { onBrowse: () => void }) {
  const D = IHYPE_DATA;
  const [tab2, setTab2] = useState('upcoming');
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid var(--line)' }}>
        {[['upcoming', 'Upcoming'], ['past', 'Past']].map(([id, lbl]) => {
          const on = tab2 === id;
          return <button key={id} onClick={() => setTab2(id)} style={{ flex: 1, padding: '8px 4px 7px', border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: on ? 'var(--ink-1)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.75rem', letterSpacing: '.04em', fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{lbl}</button>;
        })}
      </div>
      {D.fanReceipts.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', gap: 14, textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" /></svg>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>No tickets yet.</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '.82rem', color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: '28ch' }}>Find a show you love, hype the artist, and buy direct — no fees.</div>
          <button onClick={onBrowse} style={{ padding: '9px 22px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.85rem', cursor: 'pointer' }}>Browse events →</button>
        </div>
      )}
      {D.fanReceipts.map(r => {
        const isTonight = r.date.includes('May 30');
        return (
          <div key={r.id} style={{ padding: '1rem', borderRadius: 16, border: `1px solid ${isTonight ? r.tint + '55' : 'var(--line)'}`, background: `linear-gradient(135deg,${r.tint}0d,transparent)`, marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `linear-gradient(135deg,${r.tint}88,${r.tint}22)`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                {isTonight && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#ff3c3c', marginBottom: 3 }}>● Tonight</div>}
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem' }}>{r.artist}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--ink-3)', marginTop: 2 }}>{r.event} · {r.date.split(',')[0]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)' }}>×{r.qty}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--accent)' }}>${r.price}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LocalEvents({ onBuy, onFilterOpen, genreFilter }: { onBuy: (s: Show) => void; onFilterOpen: () => void; genreFilter: string }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);
  const sorted = [...IHYPE_DATA.shows].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Near Los Angeles{genreFilter !== 'All' ? ` · ${genreFilter}` : ''}</div>
        <button onClick={onFilterOpen} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.7rem', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
          Filter
        </button>
      </div>
      {loading ? [0, 1, 2].map(i => <Skeleton key={i} h={160} />) : sorted.map((s, i) => <EventCard key={s.id} s={s} onBuy={onBuy} idx={i} />)}
    </div>
  );
}

function RecommendedEvents({ onBuy, prefs }: { onBuy: (s: Show) => void; prefs: { genres?: string[] } | null }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 900); return () => clearTimeout(t); }, []);
  const hypedArtists = new Set(IHYPE_DATA.seeds.map(s => s.artist));
  const genres = prefs?.genres || [];
  const allShows = IHYPE_DATA.shows.filter(s => !SOLD_OUT.has(s.id));
  const rec = allShows.filter(s => hypedArtists.has(s.artist) || (genres.length > 0 && genres.some(g => (s.genre || '').toLowerCase().includes(g.toLowerCase()))));
  const rest = allShows.filter(s => !rec.includes(s));
  return (
    <div>
      {loading ? [0, 1].map(i => <Skeleton key={i} h={160} />) : (
        <>
          {rec.length > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Artists you've hyped</div>}
          {rec.map((s, i) => <EventCard key={s.id} s={s} onBuy={onBuy} idx={i} />)}
          {rest.length > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '16px 0 12px' }}>You might also like</div>}
          {rest.map((s, i) => <EventCard key={s.id} s={s} onBuy={onBuy} idx={i + rec.length} />)}
        </>
      )}
    </div>
  );
}

function EventSearch({ onBuy }: { onBuy: (s: Show) => void }) {
  const [q, setQ] = useState('');
  const results = q ? IHYPE_DATA.shows.filter(s => (s.artist + s.venue + s.city).toLowerCase().includes(q.toLowerCase())) : IHYPE_DATA.shows;
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search events, venues, artists…" style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }} />
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
      </div>
      {results.map(s => <EventCard key={s.id} s={s} onBuy={onBuy} />)}
    </div>
  );
}

export function EventsTab() {
  const { toast, prefs } = useApp();
  const [sub, setSub] = useState('local');
  const [checkout, setCheckout] = useState<Show | null>(null);
  const [ageGate, setAgeGate] = useState<Show | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [genreFilter, setGenreFilter] = useState('All');

  const tryCheckout = (s: Show) => s.ageReq ? setAgeGate(s) : setCheckout(s);
  const subs: [string, string][] = [['tickets', 'Tickets'], ['local', 'Local'], ['foryou', 'For You'], ['search', 'Search']];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
        {subs.map(([id, label]) => {
          const on = sub === id;
          return <button key={id} onClick={() => setSub(id)} style={{ flexShrink: 0, padding: '10px 14px 8px', borderRadius: 0, border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: on ? 'var(--ink-1)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.75rem', letterSpacing: '.04em', fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{label}</button>;
        })}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.15rem 1.5rem' }}>
        {sub === 'tickets' && <MyTickets onBrowse={() => setSub('local')} />}
        {sub === 'local' && <LocalEvents onBuy={tryCheckout} onFilterOpen={() => setFilterOpen(true)} genreFilter={genreFilter} />}
        {sub === 'foryou' && <RecommendedEvents onBuy={tryCheckout} prefs={prefs} />}
        {sub === 'search' && <EventSearch onBuy={tryCheckout} />}
      </div>
      <CheckoutSheet show={checkout} onClose={() => setCheckout(null)} onDone={() => { setCheckout(null); toast('🎟 Ticket saved!'); track('purchase_complete', { show: checkout?.id }); }} />
      {ageGate && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: 'var(--bg-surface)', borderRadius: '22px 22px 0 0', padding: '1.5rem 1.25rem 2.5rem' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>🔞</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', textAlign: 'center', marginBottom: 8 }}>Age Verification Required</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '.82rem', color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>This event requires attendees to be 21+.</div>
            <button onClick={() => { setCheckout(ageGate); setAgeGate(null); }} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', marginBottom: 10 }}>I confirm I am 21+ →</button>
            <button onClick={() => setAgeGate(null)} style={{ width: '100%', padding: '11px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.88rem', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
      <FilterSheet open={filterOpen} filter={genreFilter} onFilter={setGenreFilter} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
