'use client';
import React from 'react';
import type { WorkbenchData, WbShow } from '@/types/workbench';
import { T } from './MobilePrimitives';

// ─── Tab types & static data ──────────────────────────────────
type EventTab = 'Upcoming' | 'Favorites' | 'For you' | 'Shows';
const TAB_LIST: EventTab[] = ['Upcoming', 'Favorites', 'For you', 'Shows'];

const SAVED_VENUES = [
  { id: 'sv1', name: 'The Empty Bottle',   city: 'Chicago, IL',     tint: '#ff5029' },
  { id: 'sv2', name: 'Bowery Ballroom',    city: 'New York, NY',    tint: '#22e5d4' },
  { id: 'sv3', name: 'Troubadour',         city: 'Los Angeles, CA', tint: '#b983ff' },
  { id: 'sv4', name: 'Neumos',             city: 'Seattle, WA',     tint: '#ffb84a' },
  { id: 'sv5', name: 'Schubas Tavern',     city: 'Chicago, IL',     tint: '#ff3e9a' },
];


const FY_REASONS = ['Because you hyped similar artists', 'Trending in your city', 'Matches your genre taste', 'Artist you follow'];
const FY_TINTS = [T.teal, T.purple, T.amber, T.pink];

// ─── Tab panels ───────────────────────────────────────────────
function FavoritesTab() {
  const [venues, setVenues] = React.useState(SAVED_VENUES);
  const [cities, setCities] = React.useState(['Chicago', 'New York', 'Los Angeles', 'Austin']);
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 130px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 10 }}>Saved venues</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {venues.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.line}`, background: T.bg2 }}>
              <div style={{ width: 38, aspectRatio: '1 / 1', borderRadius: 9, flexShrink: 0, background: `linear-gradient(135deg,${v.tint}cc,${v.tint}44)`, display: 'grid', placeItems: 'center' }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13 }}>{v.name}</div>
                <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2 }}>{v.city}</div>
              </div>
              <button onClick={() => setVenues(p => p.filter(x => x.id !== v.id))} style={{ padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: T.fb, fontWeight: 600, fontSize: 12, border: `1px solid ${T.line2}`, background: 'transparent', color: T.ink3 }}>Unfollow</button>
            </div>
          ))}
          {venues.length === 0 && <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>No saved venues yet.</div>}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 10 }}>Saved cities</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {cities.map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 99, border: `1px solid ${T.line2}`, background: T.bg2 }}>
              <span style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 13, color: T.ink }}>{c}</span>
              <button onClick={() => setCities(p => p.filter(x => x !== c))} aria-label={`Unfollow ${c}`} style={{ display: 'grid', placeItems: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 10 }}>×</button>
            </div>
          ))}
          {cities.length === 0 && <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>No saved cities yet.</div>}
        </div>
      </div>
    </div>
  );
}

function ForYouTab({ data }: { data: WorkbenchData }) {
  const shows = data.shows.slice(0, 4);
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 130px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shows.map((s, i) => {
        const tint = FY_TINTS[i % FY_TINTS.length];
        return (
          <div key={s.id} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 12, padding: '14px 14px 8px' }}>
              <span style={{ width: 48, aspectRatio: '1 / 1', borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg,${tint}cc,${tint}44)`, display: 'grid', placeItems: 'center' }}>
                <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M12 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/>
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fm, fontSize: 9, color: tint, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>{FY_REASONS[i % FY_REASONS.length]}</div>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2 }}>{s.date}</div>
              </div>
            </div>
            <div style={{ padding: '4px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: T.fm, fontSize: 11, color: T.teal }}>$0 fees</span>
              <button style={{ padding: '7px 14px', borderRadius: 8, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none', color: '#fff', background: `linear-gradient(135deg,${T.accent},${T.pink})` }}>
                ${s.price} · Get tickets
              </button>
            </div>
          </div>
        );
      })}
      {shows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14 }}>
          No personalized picks yet — explore more shows!
        </div>
      )}
    </div>
  );
}

function ShowsTab({ data, onOpenRadio }: { data: WorkbenchData; onOpenRadio?: () => void }) {
  const shows = data.radioShows;
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 130px' }}>
      <div style={{ marginBottom: 14, padding: '11px 13px', borderRadius: 11, background: `${T.amber}0d`, border: `1px solid ${T.amber}33`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
        <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
          These are <strong style={{ color: T.ink }}>radio broadcasts</strong>, not live events. Tune in to hear curated shows.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', fontFamily: T.fb, fontSize: 13, color: T.ink3 }}>
            No shows on air right now.{' '}
            <button onClick={onOpenRadio} style={{ background: 'none', border: 'none', color: T.teal, cursor: 'pointer', fontFamily: T.fb, fontSize: 13, padding: 0, textDecoration: 'underline' }}>
              Open Halflight FM ↗
            </button>
          </div>
        )}
        {shows.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: `linear-gradient(90deg,${s.color}0e,${T.bg2})`, border: `1px solid ${s.color}28` }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: `linear-gradient(135deg,${s.color}cc,${s.color}44)`, display: 'grid', placeItems: 'center' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v1.5M12 20.5V22M2 12h1.5M20.5 12H22"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2 }}>{s.host} · {s.time}</div>
            </div>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: s.color, flexShrink: 0, textAlign: 'right', marginRight: 6, lineHeight: 1.4 }}>{s.listeners.toLocaleString()}<br/>listening</div>
            <button onClick={onOpenRadio} style={{ padding: '6px 12px', borderRadius: 8, flexShrink: 0, fontFamily: T.fd, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: `1px solid ${s.color}55`, background: `${s.color}14`, color: s.color }}>Tune in</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Album art placeholder ────────────────────────────────────
function AlbumArt({ c = T.accent, size = 48 }: { c?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size / 6)), background: `linear-gradient(135deg, ${c}, ${c}66 60%, ${T.bg3})`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%)' }} />
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export function ScreenShowsNew({ data, onToast, onOpenRadio }: { data: WorkbenchData; onToast?: (msg: string) => void; onOpenRadio?: () => void }) {
  const [tab, setTab] = React.useState<EventTab>('Upcoming');
  const [showView, setShowView] = React.useState<'list' | 'detail' | 'ticket'>('list');
  const [selected, setSelected] = React.useState<WbShow | null>(null);
  const [longPressShow, setLongPressShow] = React.useState<WbShow | null>(null);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = React.useRef(false);
  const [sheetDragY, setSheetDragY] = React.useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = React.useState(false);
  const sheetDragRef = React.useRef<number | null>(null);
  const shows = data.shows;

  function handleShowPointerDown(show: WbShow) {
    longPressedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      navigator.vibrate?.([10, 40, 10]);
      setLongPressShow(show);
    }, 500);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }

  if (showView === 'detail' && selected) {
    return <ShowDetailNew show={selected} onBack={() => setShowView('list')} onBuy={() => setShowView('ticket')} onToast={onToast} />;
  }
  if (showView === 'ticket' && selected) {
    return <TicketFlowNew show={selected} onBack={() => setShowView('detail')} onDone={() => setShowView('list')} />;
  }

  const tonight = shows.filter(s => s.status === 'TONIGHT');
  const nearSold = shows.filter(s => s.status === 'NEAR SOLD');
  const thisWeek = shows.filter(s => s.status === 'THIS WEEK' || s.status === 'UPCOMING');
  const sections: { label: string; items: WbShow[]; hot?: boolean; accent?: string }[] = [
    { label: 'TONIGHT',   items: tonight,  hot: true,  accent: T.accent },
    { label: 'NEAR SOLD', items: nearSold, hot: true,  accent: T.pink   },
    { label: 'THIS WEEK', items: thisWeek, hot: false, accent: T.teal   },
  ].filter(s => s.items.length > 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      {/* Header */}
      <div style={{ padding: '4px 22px 8px', flexShrink: 0 }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.teal, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          ● {shows.length > 0 ? `${shows.length} Shows` : 'Events'} in {data.city ?? 'Your City'} · 0% Fees
        </div>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '6px 0 0', lineHeight: 1 }}>Events</h1>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
        {TAB_LIST.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', borderRadius: 99, cursor: 'pointer', flexShrink: 0,
            fontFamily: T.fb, fontWeight: 600, fontSize: 13,
            border: t === tab ? `1px solid ${T.accent}55` : `1px solid ${T.line2}`,
            background: t === tab ? `${T.accent}18` : 'transparent',
            color: t === tab ? T.ink : T.ink2,
          }}>{t}</button>
        ))}
      </div>

      {/* Upcoming tab content */}
      {tab === 'Upcoming' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 130px' }}>
          {/* 0% fees banner */}
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: `${T.teal}10`, border: `1px solid ${T.teal}40`, display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.teal, color: T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>0%</div>
            <div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13 }}>Every ticket. 0% fees.</div>
              <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2 }}>Face value goes to the artist &amp; venue. Always.</div>
            </div>
          </div>

          {shows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14 }}>
              No shows right now — check back soon
              <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink4, marginTop: 8, letterSpacing: '.1em' }}>Pull down to refresh</div>
            </div>
          )}

          {sections.map(sec => (
            <div key={sec.label} style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: T.fm, fontSize: 11, color: sec.hot ? sec.accent : T.ink3, letterSpacing: '.18em', marginBottom: 8, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                {sec.hot && <span style={{ width: 5, height: 5, borderRadius: 99, background: sec.accent, display: 'inline-block', flexShrink: 0 }} />}
                {sec.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sec.items.map(show => {
                  const pct = show.capacity > 0 ? Math.round(show.sold / show.capacity * 100) : 0;
                  const cardAccent = show.status === 'TONIGHT' ? T.accent : show.status === 'NEAR SOLD' ? T.pink : T.teal;
                  return (
                    <div key={show.id}
                      onClick={() => { if (longPressedRef.current) { longPressedRef.current = false; return; } setSelected(show); setShowView('detail'); }}
                      onPointerDown={() => handleShowPointerDown(show)}
                      onPointerMove={cancelLongPress}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      style={{ background: T.bg2, border: `1px solid ${show.status === 'NEAR SOLD' ? 'rgba(255,62,154,.25)' : T.line}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
                        <AlbumArt c={cardAccent} size={48} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, letterSpacing: '-.01em' }}>{show.name}</div>
                          <div style={{ fontFamily: T.fb, fontSize: 11.5, color: T.ink2, marginTop: 2 }}>{show.venue}</div>
                          <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 3, letterSpacing: '.06em' }}>{show.date} · {show.time}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15 }}>${show.price}</div>
                          <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 2, letterSpacing: '.1em' }}>FACE</div>
                          {pct > 0 && <div style={{ fontFamily: T.fm, fontSize: 11, color: pct >= 85 ? T.pink : T.ink3, marginTop: 3, letterSpacing: '.06em' }}>{pct}% sold</div>}
                        </div>
                      </div>
                      {pct > 0 && (
                        <div style={{ height: 3, background: T.bg3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 85 ? `linear-gradient(90deg,${T.accent},${T.pink})` : `linear-gradient(90deg,${T.teal},${T.accent})`, transition: 'width .3s' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Favorites' && <FavoritesTab />}
      {tab === 'For you' && <ForYouTab data={data} />}
      {tab === 'Shows' && <ShowsTab data={data} onOpenRadio={onOpenRadio} />}

      {/* Long-press quick action sheet (Upcoming only) */}
      {tab === 'Upcoming' && longPressShow && (
        <>
          <div onClick={() => setLongPressShow(null)} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px', transform: `translateY(${sheetDragY}px)`, transition: isDraggingSheet ? 'none' : 'transform .2s', animation: 'wm-sheet-in .2s cubic-bezier(.4,0,.2,1)' }}>
            <div
              style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12, paddingTop: 4, touchAction: 'none', cursor: 'grab' }}
              onPointerDown={e => { sheetDragRef.current = e.clientY; setIsDraggingSheet(true); (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
              onPointerMove={e => { if (sheetDragRef.current === null) return; setSheetDragY(Math.max(0, e.clientY - sheetDragRef.current)); }}
              onPointerUp={e => { if (sheetDragRef.current === null) return; const dy = Math.max(0, e.clientY - sheetDragRef.current); sheetDragRef.current = null; setIsDraggingSheet(false); setSheetDragY(0); if (dy > 80) setLongPressShow(null); }}
              onPointerCancel={() => { sheetDragRef.current = null; setIsDraggingSheet(false); setSheetDragY(0); }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line2 }} />
            </div>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 4 }}>{longPressShow.name}</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, marginBottom: 18 }}>{longPressShow.venue} · {longPressShow.date}</div>
            {([
              { label: 'RSVP', color: T.teal, action: async () => { await fetch(`/api/shows/${longPressShow.id}/rsvp`, { method: 'POST' }).catch(() => {}); onToast?.(`✓ RSVP'd to ${longPressShow.name.slice(0, 30)}`); setLongPressShow(null); } },
              { label: '↗ Share', color: T.blue, action: async () => { navigator.share?.({ title: longPressShow.name, url: `/shows/${longPressShow.id}` }).catch(() => {}); setLongPressShow(null); } },
              { label: 'Get ticket', color: T.accent, action: () => { setSelected(longPressShow); setShowView('ticket'); setLongPressShow(null); } },
            ] as { label: string; color: string; action: () => void }[]).map(item => (
              <button key={item.label} onClick={() => void item.action()} style={{ width: '100%', padding: '14px 0', marginBottom: 8, borderRadius: 12, border: 'none', background: T.bg4, color: item.color, fontFamily: T.fd, fontWeight: 700, fontSize: 15, cursor: 'pointer', textAlign: 'center' }}>{item.label}</button>
            ))}
            <button onClick={() => setLongPressShow(null)} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: `1px solid ${T.line2}`, background: 'transparent', color: T.ink3, fontFamily: T.fm, fontSize: 13, cursor: 'pointer' }}>Dismiss</button>
          </div>
        </>
      )}
    </div>
  );
}

function ShowDetailNew({ show, onBack, onBuy, onToast }: { show: WbShow; onBack: () => void; onBuy: () => void; onToast?: (msg: string) => void }) {
  const pct = show.capacity > 0 ? Math.round(show.sold / show.capacity * 100) : 0;
  const showColor = show.hype > 100 ? T.accent : T.teal;
  const [rsvpState, setRsvpState] = React.useState<'idle' | 'loading' | 'done'>('idle');
  const [shareState, setShareState] = React.useState<'idle' | 'copied'>('idle');

  async function handleShare() {
    let link = `${window.location.origin}/shows/${show.id}`;
    try {
      const r = await fetch('/api/referral');
      if (r.ok) { const d = await r.json() as { referralLink?: string }; if (d.referralLink) link = d.referralLink; }
    } catch { /* use default link */ }
    const text = `${show.name} at ${show.venue} — face-value tickets, 0% fees on iHYPE 🎵`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: show.name, text, url: link }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(`${text}\n${link}`); } catch { /* ignore */ }
    setShareState('copied');
    setTimeout(() => setShareState('idle'), 2000);
  }

  const handleRsvp = async () => {
    if (rsvpState !== 'idle') return;
    setRsvpState('loading');
    try {
      await fetch(`/api/shows/${show.id}/rsvp`, { method: 'POST' });
      setRsvpState('done');
      onToast?.(`✓ RSVP'd to ${show.name.slice(0, 30)}`);
    } catch { setRsvpState('idle'); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {/* hero */}
        <div style={{ height: 190, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a22, #0e0e14)' }} />
          <svg width="100%" height="100%" viewBox="0 0 390 190" style={{ position: 'absolute', inset: 0 }}>
            <g stroke="rgba(255,255,255,.06)" fill="none" strokeWidth="1">
              {Array.from({ length: 9 }).map((_, i) => <line key={'h' + i} x1="0" y1={i * 22} x2="390" y2={i * 22} />)}
              {Array.from({ length: 18 }).map((_, i) => <line key={'v' + i} x1={i * 24} y1="0" x2={i * 24} y2="190" />)}
              <path d="M0 100 Q120 90 180 120 T390 80" stroke="rgba(255,255,255,.14)" strokeWidth="2"/>
            </g>
            <circle cx="200" cy="105" r="14" fill={showColor} fillOpacity=".2"/><circle cx="200" cy="105" r="8" fill={showColor}/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 55%, ${T.bg} 100%)` }} />
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, padding: '0 18px', display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)', border: 'none', color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M19 12H5m5-6-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        <div style={{ padding: '4px 22px 12px' }}>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: showColor, letterSpacing: '.14em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: showColor, display: 'inline-block' }}/>{show.status} · {show.time}
          </div>
          <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 28, letterSpacing: '-.025em', margin: '8px 0 0', lineHeight: 1 }}>{show.name}</h1>
          <div style={{ fontFamily: T.fb, fontSize: 14, color: T.ink2, marginTop: 5 }}>{show.venue}</div>
        </div>

        {/* demand bar */}
        <div style={{ padding: '0 22px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>Fan demand · {show.sold} / {show.capacity}</div>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: pct > 80 ? T.accent : T.teal, letterSpacing: '.06em', textTransform: 'uppercase' }}>{pct > 80 ? 'Hot' : 'On sale'}</div>
          </div>
          <div style={{ height: 6, background: T.bg2, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${T.teal}, ${T.accent})` }} />
          </div>
          <div style={{ fontFamily: T.fb, fontSize: 11, color: T.ink3, marginTop: 6 }}>{show.capacity - show.sold} left</div>
        </div>
      </div>

      {/* buy bar */}
      <div style={{ padding: '14px 22px 24px', borderTop: `1px solid ${T.line}`, background: T.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', lineHeight: 1 }}>${show.price}</div>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.teal, letterSpacing: '.08em', textTransform: 'uppercase' }}>+ $0 Fees</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.06em', textAlign: 'right', maxWidth: 130, lineHeight: 1.3, textTransform: 'uppercase' }}>100% to artist + venue</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBuy} style={{ flex: 1, padding: 14, background: T.teal, color: T.bg, border: 'none', borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="15" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="15" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><path d="M14 14h3v3h-3zm5 0h2v2h-2zm-5 5h3v2h-3zm5 0h2v2h-2z" stroke="currentColor" strokeWidth="1.4"/></svg>
            Get ticket
          </button>
          <button
            onClick={handleRsvp}
            style={{
              padding: '14px 16px', borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: rsvpState === 'done' ? 'default' : 'pointer', border: `1px solid ${rsvpState === 'done' ? T.teal + '60' : T.line2}`,
              background: rsvpState === 'done' ? `${T.teal}18` : T.bg2,
              color: rsvpState === 'done' ? T.teal : T.ink,
              transition: 'background .2s, color .2s, border-color .2s',
            }}
          >
            {rsvpState === 'done' ? '✓ RSVPed' : rsvpState === 'loading' ? '…' : 'RSVP'}
          </button>
          <button
            onClick={() => void handleShare()}
            style={{
              padding: '14px 16px', borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 13,
              cursor: 'pointer', border: `1px solid ${shareState === 'copied' ? T.accent + '60' : T.line2}`,
              background: shareState === 'copied' ? `${T.accent}18` : T.bg2,
              color: shareState === 'copied' ? T.accent : T.ink3,
              transition: 'background .2s, color .2s, border-color .2s',
            }}
            title="Share & earn"
          >
            {shareState === 'copied' ? '✓' : (
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketFlowNew({ show, onBack, onDone }: { show: WbShow; onBack: () => void; onDone: () => void }) {
  const [bought, setBought] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const showColor = show.hype > 100 ? T.accent : T.teal;

  const handleBuy = async () => {
    setLoading(true);
    try {
      await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: show.id }),
      });
      setBought(true);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ padding: '14px 22px 4px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 34, height: 34, borderRadius: 99, background: T.bg2, border: `1px solid ${T.line2}`, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M19 12H5m5-6-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 16 }}>{bought ? 'Your ticket' : 'Checkout'}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 130px', display: 'flex', flexDirection: 'column' }}>
        {/* ticket stub */}
        <div style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${T.line2}`, background: T.bg2 }}>
          <div style={{ height: 120, position: 'relative', background: `linear-gradient(135deg, ${showColor}, ${showColor}66 60%, ${T.bg3})` }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 75% 25%, rgba(255,255,255,.25), transparent 60%)' }} />
            <div style={{ position: 'absolute', left: 18, bottom: 14 }}>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: 'rgba(0,0,0,.6)', letterSpacing: '.14em' }}>{show.date} · {show.time}</div>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, color: 'rgba(255,255,255,.97)', textShadow: '0 1px 8px rgba(0,0,0,.4)', lineHeight: 1, marginTop: 3 }}>{show.name}</div>
            </div>
          </div>
          {/* perforation */}
          <div style={{ position: 'relative', height: 0 }}>
            <div style={{ position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: 99, background: T.bg }} />
            <div style={{ position: 'absolute', right: -8, top: -8, width: 16, height: 16, borderRadius: 99, background: T.bg }} />
            <div style={{ borderTop: `2px dashed ${T.line2}`, margin: '0 14px' }} />
          </div>
          <div style={{ padding: 18 }}>
            {bought ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 150, height: 150, borderRadius: 12, background: '#fff', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(11,1fr)', gap: 2 }}>
                  {Array.from({ length: 121 }).map((_, i) => {
                    const on = (i * 7 % 13 + i % 5 + ((i * i) % 9)) % 3 === 0 || [0, 1, 2, 9, 10, 11, 21, 22, 99, 109, 110, 120, 119, 118, 108].includes(i);
                    return <div key={i} style={{ background: on ? '#0a0805' : 'transparent', borderRadius: 1 }} />;
                  })}
                </div>
                <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', marginTop: 14, textTransform: 'uppercase' }}>
                  {show.id.slice(0, 8).toUpperCase()} · Scan at door
                </div>
                <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 99, background: `${T.purple}18`, color: T.purple, fontFamily: T.fm, fontSize: 11, letterSpacing: '.04em', fontWeight: 600 }}>Check in for +10 Hype · 1.5× boost</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['General admission', `$${show.price}.00`], ['Service fee', '$0.00'], ['Facility fee', '$0.00']].map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 12.5 }}>
                    <span style={{ color: T.ink3 }}>{k}</span>
                    <span style={{ color: i === 0 ? T.ink : T.teal }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 4, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.fm, fontSize: 10, letterSpacing: '.14em', color: T.ink2, textTransform: 'uppercase' }}>Total</span>
                  <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 26, color: T.teal, letterSpacing: '-.02em' }}>${show.price}.00</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {!bought && (
          <div style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 13, color: T.ink3, marginTop: 14, lineHeight: 1.45, textAlign: 'center' }}>
            Every cent of your ${show.price} goes to {show.name} and {show.venue}. iHYPE takes nothing.
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          {bought
            ? <button onClick={onDone} style={{ width: '100%', padding: 15, background: T.bg2, color: T.ink, border: `1px solid ${T.line2}`, borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Done</button>
            : <button onClick={handleBuy} disabled={loading} style={{ width: '100%', padding: 15, background: T.teal, color: T.bg, border: 'none', borderRadius: 12, fontFamily: T.fd, fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="15" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="15" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><path d="M14 14h3v3h-3zm5 0h2v2h-2zm-5 5h3v2h-3zm5 0h2v2h-2z" stroke="currentColor" strokeWidth="1.4"/></svg>
                {loading ? 'Processing...' : `Pay $${show.price} · Apple Pay`}
              </button>}
        </div>
      </div>
    </div>
  );
}
