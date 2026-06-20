'use client';
import React from 'react';
import type { WorkbenchData, WbShow } from '@/types/workbench';
import { T } from './MobilePrimitives';

type EventSubTab = 'tickets' | 'local' | 'foryou' | 'search';
const SUB_TABS: { id: EventSubTab; label: string }[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'local',   label: 'Local'   },
  { id: 'foryou',  label: 'For You' },
  { id: 'search',  label: 'Search'  },
];

const GENRES = ['All', 'dream-pop', 'shoegaze', 'lo-fi', 'r&b', 'electronic', 'folk'];
const FY_REASONS = ['Because you hyped similar artists', 'Trending in your city', 'Matches your genre taste', 'Artist you follow'];
const FY_TINTS = [T.teal, T.purple, T.amber, T.pink];

// ─── Skeleton loader ──────────────────────────────────────────
function Skeleton({ h = 120 }: { h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 18, background: T.bg2, border: `1px solid ${T.line}`, marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%)', backgroundSize: '200% 100%', animation: 'ihype-skeleton 1.4s ease-in-out infinite' }} />
    </div>
  );
}

// ─── Checkout sheet ────────────────────────────────────────────
function CheckoutSheet({ show, onClose, onDone }: { show: WbShow | null; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = React.useState(1);
  if (!show) return null;
  const gross = (show.price * qty).toFixed(2);
  const tm = (show.price * 1.27 * qty).toFixed(2);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: T.bg2, borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: '0 auto 18px' }} />
        <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 19, letterSpacing: '-.03em', marginBottom: 4 }}>{show.name}</div>
        <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, marginBottom: 18 }}>{show.venue} · {show.date}</div>
        {/* 45/45/10 split bar */}
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 16 }}>
          <div style={{ flex: 45, background: T.accent, borderRadius: '999px 0 0 999px' }} />
          <div style={{ flex: 45, background: T.teal }} />
          <div style={{ flex: 10, background: T.purple, borderRadius: '0 999px 999px 0' }} />
        </div>
        {/* TM comparison */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 11, background: T.bg3, marginBottom: 14 }}>
          <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>Ticketmaster: ${tm}</span>
          <span style={{ fontFamily: T.fd, fontWeight: 800, color: T.teal }}>You pay ${gross}</span>
        </div>
        {/* Qty */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>Qty</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${T.line}`, background: T.bg3, color: T.ink, cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>−</button>
            <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => Math.min(4, q + 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${T.line}`, background: T.bg3, color: T.ink, cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>+</button>
          </div>
        </div>
        <button onClick={onDone} style={{ width: '100%', padding: '13px', borderRadius: 999, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,80,41,.3)' }}>
          Pay ${gross} · Apple Pay
        </button>
        <p style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, textAlign: 'center', marginTop: 8 }}>+ $0.00 fees · 45% to artist · locked in charter</p>
      </div>
    </div>
  );
}

// ─── Filter sheet ──────────────────────────────────────────────
function FilterSheet({ open, genre, onGenre, onClose }: { open: boolean; genre: string; onGenre: (g: string) => void; onClose: () => void }) {
  if (!open) return null;
  const [maxPrice, setMaxPrice] = React.useState(50);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: T.bg2, borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: '0 auto 18px' }} />
        <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 17, marginBottom: 16 }}>Filter events</div>
        <div style={{ fontFamily: T.fm, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, marginBottom: 8 }}>Genre</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {GENRES.map(g => {
            const on = genre === g;
            return (
              <button key={g} onClick={() => onGenre(g)} style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? T.accent : T.line}`, background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? T.accent : T.ink2, fontFamily: T.fm, fontSize: 12, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{g}</button>
            );
          })}
        </div>
        <div style={{ fontFamily: T.fm, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, marginBottom: 8 }}>Max price: ${maxPrice}</div>
        <input type="range" min={5} max={100} value={maxPrice} onChange={e => setMaxPrice(+e.target.value)} style={{ width: '100%', accentColor: T.accent, marginBottom: 16 }} />
        <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 999, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Apply filters</button>
      </div>
    </div>
  );
}

// ─── Event card ───────────────────────────────────────────────
function EventCard({ show, onBuy }: { show: WbShow; onBuy: (s: WbShow) => void }) {
  const [hyped, setHyped] = React.useState(false);
  const [shareState, setShareState] = React.useState<'idle' | 'copied'>('idle');
  const soldOut = show.capacity > 0 && show.sold >= show.capacity;
  const pct = show.capacity > 0 ? Math.round(show.sold / show.capacity * 100) : 0;
  const showColor = show.status === 'TONIGHT' ? T.accent : show.status === 'NEAR SOLD' ? T.pink : T.teal;

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const link = `${window.location.origin}/shows/${show.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: show.name, url: link }); return; }
      await navigator.clipboard.writeText(link);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div style={{ borderRadius: 18, border: `1px solid ${T.line}`, background: T.bg2, overflow: 'hidden', marginBottom: 12 }}>
      {/* hero */}
      <div style={{ height: 100, background: `linear-gradient(135deg,${showColor}44,${showColor}11)`, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%,${showColor}44,transparent 60%)` }} />
        <div style={{ position: 'absolute', bottom: 10, left: 14 }}>
          <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, letterSpacing: '-.03em' }}>{show.name}</div>
          <div style={{ fontFamily: T.fm, fontSize: 11, color: 'rgba(240,235,229,.7)' }}>{show.venue}</div>
        </div>
        {soldOut && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,5,4,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <span style={{ fontFamily: T.fm, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.7)', padding: '5px 14px', borderRadius: 999, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.15)' }}>Sold out</span>
          </div>
        )}
        {show.status === 'TONIGHT' && !soldOut && (
          <div style={{ position: 'absolute', top: 10, right: 12, fontFamily: T.fm, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#ff3c3c', background: 'rgba(255,60,60,.15)', border: '1px solid rgba(255,60,60,.3)', borderRadius: 999, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff3c3c' }} />Tonight
          </div>
        )}
      </div>
      {/* footer */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3 }}>{show.date}</span>
            {pct > 80 && <span style={{ fontFamily: T.fm, fontSize: 10, color: T.pink, padding: '2px 7px', borderRadius: 999, border: `1px solid ${T.pink}44`, background: `${T.pink}12` }}>{pct}% sold</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18 }}>${show.price}</span>
            <span style={{ fontFamily: T.fm, fontSize: 11, color: T.teal }}>+ $0 fees</span>
          </div>
        </div>
        {/* hype */}
        <button onClick={e => { e.stopPropagation(); setHyped(h => !h); }} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${hyped ? T.accent : T.line}`, background: hyped ? 'rgba(255,80,41,.12)' : 'transparent', color: hyped ? T.accent : T.ink3, cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {hyped ? '🔥' : '☆'}
        </button>
        {/* share */}
        <button onClick={handleShare} title="Copy referral link" style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${shareState === 'copied' ? T.accent + '60' : T.line}`, background: shareState === 'copied' ? `${T.accent}18` : 'transparent', color: shareState === 'copied' ? T.accent : T.ink3, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {shareState === 'copied' ? '✓' : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          )}
        </button>
        {/* buy */}
        {soldOut
          ? <button style={{ padding: '8px 14px', borderRadius: 999, background: 'transparent', color: T.ink3, border: `1px solid ${T.line}`, fontFamily: T.fm, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Waitlist</button>
          : <button onClick={e => { e.stopPropagation(); onBuy(show); }} style={{ padding: '8px 18px', borderRadius: 999, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>Get ticket</button>
        }
      </div>
      {/* sold % bar */}
      {pct > 0 && (
        <div style={{ height: 3, background: T.bg4 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 85 ? `linear-gradient(90deg,${T.accent},${T.pink})` : `linear-gradient(90deg,${T.teal},${T.accent})` }} />
        </div>
      )}
    </div>
  );
}

// ─── My Tickets tab ───────────────────────────────────────────
function TicketsTab({ data, onBuy }: { data: WorkbenchData; onBuy: (s: WbShow) => void }) {
  const [subtab, setSubtab] = React.useState<'upcoming' | 'past'>('upcoming');
  const upcoming = data.shows.filter(s => s.status === 'TONIGHT' || s.status === 'UPCOMING' || s.status === 'THIS WEEK' || s.status === 'NEAR SOLD');

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: `1px solid ${T.line}` }}>
        {(['upcoming', 'past'] as const).map(id => {
          const on = subtab === id;
          return (
            <button key={id} onClick={() => setSubtab(id)} style={{ flex: 1, padding: '8px 4px 7px', border: 'none', borderBottom: on ? `2px solid ${T.accent}` : '2px solid transparent', background: 'transparent', color: on ? T.ink : T.ink3, fontFamily: T.fm, fontSize: 12, letterSpacing: '.04em', fontWeight: on ? 700 : 500, cursor: 'pointer', textTransform: 'capitalize' }}>{id}</button>
          );
        })}
      </div>

      {upcoming.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎟</div>
          <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>No tickets yet.</div>
          <div style={{ fontFamily: T.fb, fontSize: 13, color: T.ink2, lineHeight: 1.6, marginBottom: 20 }}>Browse local events and get tickets at face value — zero fees.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {upcoming.map(show => {
            const isTonight = show.status === 'TONIGHT';
            return (
              <div key={show.id} style={{ padding: '1rem', borderRadius: 16, border: `1px solid ${isTonight ? T.accent + '55' : T.line}`, background: `linear-gradient(135deg,${T.accent}0d,transparent)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: `linear-gradient(135deg,${T.accent}88,${T.accent}22)`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {isTonight && <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#ff3c3c', marginBottom: 3 }}>● Tonight</div>}
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 15 }}>{show.name}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, marginTop: 2 }}>{show.venue} · {show.date}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, color: T.accent }}>${show.price}</div>
                  </div>
                </div>
                {/* QR stub */}
                <div style={{ marginTop: 12, padding: '12px', borderRadius: 14, background: T.bg3, border: `1px solid ${T.line}`, marginBottom: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, flexShrink: 0, background: '#fff', borderRadius: 8, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1.5 }}>
                    {Array.from({ length: 49 }, (_, i) => {
                      const fill = [0,1,2,7,8,14,6,13,42,43,44,48,35,36,41].includes(i) || (i > 16 && i < 26 && i % 2 === 0);
                      return <div key={i} style={{ background: fill ? '#0a0805' : 'transparent', borderRadius: 1 }} />;
                    })}
                  </div>
                  <div>
                    <div style={{ fontFamily: T.fb, fontWeight: 700, fontSize: 13 }}>Show at door</div>
                    <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 2 }}>QR code · works offline</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${T.line}`, background: 'transparent', color: T.ink2, fontFamily: T.fm, fontSize: 12, cursor: 'pointer' }}>Transfer →</button>
                  <button style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${T.line}`, background: 'transparent', color: T.ink2, fontFamily: T.fm, fontSize: 12, cursor: 'pointer' }}>Rate show ★</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Local events tab ─────────────────────────────────────────
function LocalTab({ data, onBuy, onFilterOpen, genre }: { data: WorkbenchData; onBuy: (s: WbShow) => void; onFilterOpen: () => void; genre: string }) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);

  function refresh() { setRefreshing(true); setTimeout(() => setRefreshing(false), 900); }

  const shows = [...data.shows].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.ink3 }}>
          Near {data.city ?? 'you'}{genre !== 'All' ? ` · ${genre}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} style={{ background: 'none', border: 'none', color: T.ink3, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: refreshing ? 'spin .8s linear infinite' : 'none' }}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
          </button>
          <button onClick={onFilterOpen} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, border: `1px solid ${T.line}`, background: 'transparent', color: T.ink3, fontFamily: T.fm, fontSize: 11, cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filter
          </button>
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}} @keyframes ihype-skeleton{0%,100%{opacity:.4}50%{opacity:.8}}'}</style>
      {(loading || refreshing)
        ? [0, 1, 2].map(i => <Skeleton key={i} h={160} />)
        : <>
            {shows.map(s => <EventCard key={s.id} show={s} onBuy={onBuy} />)}
            {shows.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', fontFamily: T.fm, fontSize: 13, color: T.ink3 }}>
                No events near you right now.
              </div>
            )}
          </>
      }
    </div>
  );
}

// ─── For You tab ─────────────────────────────────────────────
function ForYouTab({ data, onBuy }: { data: WorkbenchData; onBuy: (s: WbShow) => void }) {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { const t = setTimeout(() => setLoading(false), 900); return () => clearTimeout(t); }, []);

  const shows = data.shows;

  return (
    <div>
      {loading ? [0, 1].map(i => <Skeleton key={i} h={160} />) : (
        <>
          {shows.length > 0 && <div style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.accent, marginBottom: 12 }}>Picked for you</div>}
          {shows.map((s, i) => {
            const tint = FY_TINTS[i % FY_TINTS.length];
            return (
              <div key={s.id} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 12, padding: '14px 14px 8px' }}>
                  <span style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg,${tint}cc,${tint}44)`, display: 'grid', placeItems: 'center' }}>
                    <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.fm, fontSize: 9, color: tint, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>{FY_REASONS[i % FY_REASONS.length]}</div>
                    <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 2 }}>{s.date}</div>
                  </div>
                </div>
                <div style={{ padding: '4px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.teal }}>$0 fees</span>
                  <button onClick={() => onBuy(s)} style={{ padding: '7px 14px', borderRadius: 8, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none', color: '#fff', background: `linear-gradient(135deg,${T.accent},${T.pink})` }}>
                    ${s.price} · Get tickets
                  </button>
                </div>
              </div>
            );
          })}
          {shows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14 }}>
              No personalized picks yet — keep exploring!
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Search tab ───────────────────────────────────────────────
function SearchEventsTab({ data, onBuy }: { data: WorkbenchData; onBuy: (s: WbShow) => void }) {
  const [q, setQ] = React.useState('');
  const shows = data.shows;
  const results = q ? shows.filter(s => (s.name + s.venue).toLowerCase().includes(q.toLowerCase())) : shows;

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.ink3, pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search events, venues, artists…"
          style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 12, border: `1px solid ${T.line}`, background: T.bg3, color: T.ink, fontFamily: T.fb, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
        {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.ink3, cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>}
      </div>
      {results.map(s => <EventCard key={s.id} show={s} onBuy={onBuy} />)}
      {results.length === 0 && q && (
        <div style={{ textAlign: 'center', padding: '2rem', fontFamily: T.fm, fontSize: 13, color: T.ink3 }}>No results for &ldquo;{q}&rdquo;</div>
      )}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export function ScreenShowsNew({ data, onToast, onOpenRadio }: { data: WorkbenchData; onToast?: (msg: string) => void; onOpenRadio?: () => void }) {
  const [tab, setTab] = React.useState<EventSubTab>('local');
  const [checkout, setCheckout] = React.useState<WbShow | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [genre, setGenre] = React.useState('All');

  function handleBuy(show: WbShow) { setCheckout(show); }
  function handleBuyDone() { setCheckout(null); onToast?.('🎟 Ticket saved'); }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb, position: 'relative' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 0, padding: '0 1rem', overflowX: 'auto', flexShrink: 0, borderBottom: `1px solid ${T.line}`, scrollbarWidth: 'none' }}>
        {SUB_TABS.map(({ id, label }) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              flexShrink: 0, padding: '10px 14px 8px', borderRadius: 0,
              border: 'none', borderBottom: on ? `2px solid ${T.accent}` : '2px solid transparent',
              background: 'transparent', color: on ? T.ink : T.ink3,
              fontFamily: T.fm, fontSize: 12, letterSpacing: '.04em', fontWeight: on ? 700 : 500, cursor: 'pointer', transition: 'color .15s, border-color .15s',
            }}>{label}</button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 18px 130px' }}>
        {tab === 'tickets' && <TicketsTab data={data} onBuy={handleBuy} />}
        {tab === 'local'   && <LocalTab data={data} onBuy={handleBuy} onFilterOpen={() => setFilterOpen(true)} genre={genre} />}
        {tab === 'foryou'  && <ForYouTab data={data} onBuy={handleBuy} />}
        {tab === 'search'  && <SearchEventsTab data={data} onBuy={handleBuy} />}
      </div>

      <CheckoutSheet show={checkout} onClose={() => setCheckout(null)} onDone={handleBuyDone} />
      <FilterSheet open={filterOpen} genre={genre} onGenre={g => { setGenre(g); setFilterOpen(false); }} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
