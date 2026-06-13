'use client';
import React, { useState, useEffect } from 'react';
import type { WorkbenchData, WbTrack } from '@/types/workbench';
import { T, WMPill } from './MobilePrimitives';
import { DiscoverDailyCard } from './DiscoverDailyCard';

// ─── Icons (local, only needed here) ─────────────────────────
const WMIcon = {
  radio: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>,
};

type ChartTrack = {
  id: string; title: string; artistName: string;
  hypeCount: number; color: string;
};

// ─── Album art gradient placeholder ──────────────────────────
function AlbumArt({ c = T.accent, size = 48 }: { c?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size / 6)), background: `linear-gradient(135deg, ${c}, ${c}66 60%, ${T.bg3})`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%)' }} />
    </div>
  );
}

// ─── Screen: Listen ──────────────────────────────────────────
export function ScreenListen({ data, onPlay, onExpand, currentIdx }: {
  data: WorkbenchData;
  onPlay: (i: number) => void;
  onExpand: () => void;
  currentIdx: number;
}) {
  const [q, setQ] = useState('');
  const [charts, setCharts] = useState<{ national: ChartTrack[]; local: ChartTrack[]; forYou: ChartTrack[] } | null>(null);
  const [chartTab, setChartTab] = useState<'local' | 'national' | 'forYou'>('local');
  useEffect(() => {
    fetch(`/api/charts?city=${encodeURIComponent(data.city ?? '')}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCharts(d); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queue = data.tracks;
  // Static playlist shapes mapped to real data
  const playlists = [
    { n: "Tonight's Queue", meta: `${queue.length} tracks · auto-mixed`, c: T.accent },
    { n: 'Hyped by You',    meta: `${data.lifeStats?.totalHype ?? 0} hypes`,  c: T.purple },
    { n: `${data.city ?? 'Local'} Indie`, meta: 'Local scene', c: T.teal },
    { n: 'Late Drives',     meta: 'Your mix',    c: T.amber },
  ];
  // Rising = top 5 by hypeCount; search covers the full queue
  const allRising = [...queue].sort((a, b) => b.hypeCount - a.hypeCount).slice(0, 5);
  const rising = allRising;
  const ql = q.toLowerCase().trim();
  const searchResults = ql
    ? queue.filter(t => t.title.toLowerCase().includes(ql) || t.artistName.toLowerCase().includes(ql)).slice(0, 20)
    : [];

  const dayParts = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
  const h = new Date().getHours();
  const timeLabel = h < 12 ? dayParts[0] : h < 17 ? dayParts[1] : h < 21 ? dayParts[2] : dayParts[3];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: T.ink, fontFamily: T.fb }}>
      <div style={{ padding: '4px 22px 12px', flexShrink: 0 }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {timeLabel} · {data.city ?? 'YOUR CITY'}
        </div>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '6px 0 0', lineHeight: 1 }}>Listen</h1>
        <div style={{ marginTop: 12, position: 'relative' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.ink3, pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search tracks & artists…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px 9px 32px',
              background: T.bg3, border: `1px solid rgba(255,255,255,.07)`,
              borderRadius: 12, color: T.ink, fontFamily: T.fb, fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 130px' }}>
        {ql ? (
          /* ── search results ── */
          <div style={{ padding: '0 22px' }}>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
              {searchResults.length ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${q}"` : `No results for "${q}"`}
            </div>
            {searchResults.length === 0 ? (
              <div style={{ paddingTop: 40, color: T.ink3, fontFamily: T.fm, fontSize: 12, textAlign: 'center' }}>
                Try searching for a track title or artist name
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {searchResults.map((tk, i) => (
                  <div key={tk.id} onClick={() => onPlay(queue.indexOf(tk))} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 11, cursor: 'pointer',
                    background: currentIdx === queue.indexOf(tk) ? `${tk.color}12` : 'transparent',
                    border: `1px solid ${currentIdx === queue.indexOf(tk) ? `${tk.color}40` : 'transparent'}`,
                  }}>
                    <div style={{ width: 22, textAlign: 'center', fontFamily: T.fd, fontWeight: 800, fontSize: 15, color: T.ink3 }}>{i + 1}</div>
                    <AlbumArt c={tk.color} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tk.title}</div>
                      <div style={{ fontFamily: T.fb, fontSize: 11.5, color: T.ink3, marginTop: 1 }}>{tk.artistName}</div>
                    </div>
                    <div style={{ fontFamily: T.fm, fontSize: 10, color: T.pink, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>♥ {tk.hypeCount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (<>
        {/* Hero: resume queue */}
        <div onClick={() => { onPlay(0); onExpand(); }} style={{
          margin: '0 22px 20px', padding: 18, borderRadius: 18, position: 'relative', overflow: 'hidden', cursor: 'pointer',
          background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accent}88 32%, ${T.bg3} 100%)`,
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 18%, rgba(255,255,255,.28), transparent 55%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.bg, letterSpacing: '.16em', opacity: .85, textTransform: 'uppercase' }}>● Pick up where you left off</div>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 23, color: T.bg, marginTop: 8, lineHeight: 1.02, letterSpacing: '-.02em' }}>Tonight&#39;s Queue</div>
            <div style={{ fontFamily: T.fb, fontSize: 12, color: 'rgba(0,0,0,.65)', marginTop: 5 }}>{queue.length} tracks · finish a track to Hype it</div>
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: T.bg, color: T.ink, borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8L6 20z"/></svg> Play
            </div>
          </div>
        </div>

        {/* Daily discovery pick — same card the desktop workbench shows */}
        <div style={{ margin: '0 22px 20px' }}>
          <DiscoverDailyCard />
        </div>

        {/* Your playlists */}
        <div style={{ padding: '0 22px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em' }}>Your playlists</div>
          <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.accent, letterSpacing: '.1em' }}>ALL ›</div>
        </div>
        <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 22px 4px', marginBottom: 22, scrollbarWidth: 'none' }}>
          {playlists.map((p, i) => (
            <div key={i} onClick={() => onPlay(i % Math.max(1, queue.length))} style={{ width: 130, flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ width: 130, height: 130, borderRadius: 14, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${p.c}, ${p.c}55 60%, ${T.bg3})` }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 28% 24%, rgba(255,255,255,.25), transparent 60%)' }} />
                <div style={{ position: 'absolute', left: 10, bottom: 9, fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: 'rgba(255,255,255,.95)', textShadow: '0 1px 6px rgba(0,0,0,.5)', lineHeight: 1, maxWidth: 108 }}>{p.n}</div>
              </div>
              <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.ink3, marginTop: 7, letterSpacing: '.04em' }}>{p.meta}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ marginTop: 22 }}>
          <div style={{ padding: '0 22px 10px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em' }}>Charts</div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '0 22px 14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {([
              { k: 'local'    as const, l: data.city ?? 'Local'   },
              { k: 'national' as const, l: 'National'              },
              { k: 'forYou'   as const, l: 'For You'               },
            ]).map(tab => (
              <button key={tab.k} onClick={() => setChartTab(tab.k)} style={{
                padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: T.fm, fontSize: 11, letterSpacing: '.08em', fontWeight: 700,
                background: chartTab === tab.k ? T.purple : T.bg3,
                color: chartTab === tab.k ? T.bg : T.ink3,
                transition: 'background .15s, color .15s',
              }}>{tab.l}</button>
            ))}
          </div>
          {(() => {
            const tabTracks: ChartTrack[] = charts?.[chartTab] ?? rising.slice(0, 5);
            if (!tabTracks.length) return (
              <div style={{ padding: '20px 22px', color: T.ink3, fontFamily: T.fm, fontSize: 12, textAlign: 'center' }}>
                {chartTab === 'local' ? `No local tracks yet in ${data.city ?? 'your city'}` : 'No chart data yet — keep hyping tracks'}
              </div>
            );
            return (
              <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {tabTracks.slice(0, 10).map((tk, i) => (
                  <div key={tk.id} onClick={() => onPlay(Math.max(0, queue.findIndex(q2 => q2.id === tk.id)))} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 11, cursor: 'pointer',
                  }}>
                    <div style={{ width: 22, textAlign: 'center', fontFamily: T.fd, fontWeight: 800, fontSize: 15, color: i < 3 ? T.purple : T.ink3 }}>{i + 1}</div>
                    <AlbumArt c={tk.color} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tk.title}</div>
                      <div style={{ fontFamily: T.fb, fontSize: 11.5, color: T.ink3, marginTop: 1 }}>{tk.artistName}</div>
                    </div>
                    <div style={{ fontFamily: T.fm, fontSize: 10, color: T.pink, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>♥ {tk.hypeCount}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Algorithmic radio stations */}
        <div style={{ marginTop: 28 }}>
          <div style={{ padding: '0 22px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em' }}>Stations</div>
            <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.pink, letterSpacing: '.1em' }}>AUTO-MIX</div>
          </div>
          <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 22px 4px', scrollbarWidth: 'none' }}>
            {([
              { n: 'Your Mix',    sub: 'Tuned to your hypes',     c: T.purple },
              { n: 'Local Scene', sub: data.city ?? 'Nearby artists', c: T.teal   },
              { n: 'Rising Now',  sub: '7-day chart risers',      c: T.pink   },
            ] as const).map((s, si) => (
              <div key={s.n} onClick={() => { onPlay(si % Math.max(1, queue.length)); onExpand(); }} style={{ width: 148, flexShrink: 0, cursor: 'pointer' }}>
                <div style={{ width: 148, height: 148, borderRadius: 14, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${s.c}, ${s.c}55 60%, ${T.bg3})` }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 28% 24%, rgba(255,255,255,.22), transparent 60%)' }} />
                  <div style={{ position: 'absolute', top: 9, left: 9 }}>
                    <div style={{ background: 'rgba(0,0,0,.45)', borderRadius: 99, padding: '3px 8px', fontFamily: T.fm, fontSize: 9, color: 'rgba(255,255,255,.8)', letterSpacing: '.1em' }}>STATION</div>
                  </div>
                  <div style={{ position: 'absolute', left: 10, bottom: 9, right: 9 }}>
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,.95)', textShadow: '0 1px 6px rgba(0,0,0,.5)', lineHeight: 1.1 }}>{s.n}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 9.5, color: 'rgba(255,255,255,.65)', marginTop: 3, letterSpacing: '.04em' }}>{s.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live radio shows */}
        {data.radioShows.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ padding: '0 22px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 16, height: 16, color: T.pink }}>{WMIcon.radio}</div>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em' }}>Live Radio</div>
                {data.radioShows.some(r => r.live) && (
                  <WMPill tone="live">● LIVE</WMPill>
                )}
              </div>
              <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.pink, letterSpacing: '.1em' }}>
                {data.radioShows.reduce((a, r) => a + r.listeners, 0).toLocaleString()} listening
              </div>
            </div>
            <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 22px 4px', scrollbarWidth: 'none' }}>
              {data.radioShows.map(r => (
                <div key={r.id} style={{ width: 148, flexShrink: 0 }}>
                  <div style={{
                    width: 148, height: 148, borderRadius: 14, position: 'relative', overflow: 'hidden',
                    background: `linear-gradient(135deg, ${r.color}, ${r.color}55 60%, ${T.bg3})`,
                    border: r.live ? `1.5px solid ${r.color}80` : `1px solid ${T.line}`,
                  }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 28% 24%, rgba(255,255,255,.22), transparent 60%)' }} />
                    {r.live && (
                      <div style={{ position: 'absolute', top: 9, left: 9 }}>
                        <WMPill tone="live">● ON AIR</WMPill>
                      </div>
                    )}
                    <div style={{ position: 'absolute', left: 10, bottom: 9, right: 9 }}>
                      <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,.95)', textShadow: '0 1px 6px rgba(0,0,0,.5)', lineHeight: 1.1 }}>{r.name}</div>
                      <div style={{ fontFamily: T.fm, fontSize: 9.5, color: 'rgba(255,255,255,.65)', marginTop: 3, letterSpacing: '.04em' }}>{r.host}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: T.fm, fontSize: 9.5, color: T.ink3, marginTop: 7, letterSpacing: '.04em' }}>
                    {r.live ? `${r.listeners.toLocaleString()} listening` : r.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

// ─── Full Player overlay with pull-up-to-hype ─────────────────
export function FullPlayer({ track, playing, onToggle, onCollapse, onHype, progress }: {
  track: WbTrack;
  playing: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onHype: () => void;
  progress: number;
}) {
  const [pull, setPull] = React.useState(0);
  const drag = React.useRef<{ y: number } | null>(null);

  const startDrag = (y: number) => { drag.current = { y }; };
  const moveDrag = (y: number) => {
    if (!drag.current) return;
    const dy = drag.current.y - y;
    setPull(Math.max(0, Math.min(1, dy / 150)));
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    setPull(p => { if (p >= 1) { onHype(); } return 0; });
  };

  const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const elapsed = Math.round(track.durationSec * progress);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      color: T.ink, fontFamily: T.fb,
      background: `linear-gradient(180deg, ${track.color}38 0%, ${T.bg} 52%), ${T.bg}`,
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px 4px' }}>
        <button onClick={onCollapse} style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.1)', border: 'none', color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-5 6l6-6-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(90 12 12)"/></svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase' }}>Now Playing</div>
          <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>Tonight&#39;s Queue</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: T.ink, cursor: 'pointer' }}>⋯</div>
      </div>

      {/* art */}
      <div style={{ padding: '18px 30px 0' }}>
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 20, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}77 50%, ${T.bg3})`, boxShadow: `0 30px 80px ${track.color}40` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.3), transparent 55%)' }} />
          <div style={{ position: 'absolute', left: 20, bottom: 20, fontFamily: T.fd, fontWeight: 800, fontSize: 34, color: 'rgba(255,255,255,.95)', textShadow: '0 2px 14px rgba(0,0,0,.5)', letterSpacing: '-.02em', lineHeight: .95, textTransform: 'uppercase', maxWidth: '80%' }}>{track.title}</div>
        </div>
      </div>

      {/* meta */}
      <div style={{ padding: '22px 30px 0' }}>
        <h1 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 26, margin: 0, letterSpacing: '-.02em', lineHeight: 1 }}>{track.title}</h1>
        <div style={{ fontFamily: T.fb, fontSize: 15, color: T.ink2, marginTop: 5 }}>{track.artistName}</div>
      </div>

      {/* progress */}
      <div style={{ padding: '20px 30px 0' }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 2 }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: T.ink, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', right: -5, top: -4, width: 12, height: 12, borderRadius: 99, background: T.ink }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 11, color: T.ink3, marginTop: 8 }}>
          <span>{fmtSec(elapsed)}</span><span>{track.duration}</span>
        </div>
      </div>

      {/* transport */}
      <div style={{ padding: '14px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, padding: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M11 19V5l-9 7 9 7zm2-14v14l9-7-9-7z"/></svg>
        </button>
        <button onClick={onToggle} style={{ width: 68, height: 68, borderRadius: 99, background: T.ink, color: T.bg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
          {playing
            ? <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            : <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8L6 20z"/></svg>}
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, padding: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M13 5v14l9-7-9-7zm-11 0v14l9-7-9-7z"/></svg>
        </button>
      </div>

      {/* HYPE PULL ZONE */}
      <div
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startDrag(e.clientY); }}
        onPointerMove={e => moveDrag(e.clientY)}
        onPointerUp={endDrag}
        style={{ marginTop: 'auto', padding: '0 16px 18px', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      >
        <div style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden',
          border: `1px solid ${T.accent}${pull > 0 ? '80' : '40'}`,
          background: T.bg2, height: 64 + pull * 44,
          transition: drag.current ? 'none' : 'height .25s cubic-bezier(.2,.8,.2,1)',
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pull * 100}%`, background: `linear-gradient(180deg, ${T.accent}cc, ${T.accent})`, transition: drag.current ? 'none' : 'height .25s' }} />
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: pull > 0.5 ? T.bg : T.accent }}>
              <svg width={pull > 0.5 ? 24 : 20} height={pull > 0.5 ? 24 : 20} viewBox="0 0 24 24" fill="currentColor" style={{ transform: `scale(${1 + pull * 0.5}) translateY(${-pull * 4}px)`, transition: drag.current ? 'none' : 'transform .2s' }}>
                <path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/>
              </svg>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, letterSpacing: '-.01em' }}>
                {pull >= 1 ? 'Release to Hype' : 'Cast Hype'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: pull > 0.5 ? 'rgba(0,0,0,.6)' : T.ink3, fontFamily: T.fm, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ↑ Pull up to cast
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hype confirmation overlay ─────────────────────────────────
export function HypeOverlay({ track, onDone }: { track: WbTrack; onDone: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '0 34px', textAlign: 'center',
      background: T.bg, color: T.ink, fontFamily: T.fb, overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 38%, ${T.accent}33, transparent 60%)` }} />
      <div style={{
        position: 'relative', width: 140, height: 140, borderRadius: 99,
        border: `2px solid ${T.accent}`, background: `${T.accent}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30,
        animation: 'hypePop .5s cubic-bezier(.2,1.3,.4,1) both',
      }}>
        <svg width={70} height={70} viewBox="0 0 24 24" fill={T.accent}>
          <path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/>
        </svg>
        {[0, 60, 120, 180, 240, 300].map(a => (
          <div key={a} style={{ position: 'absolute', width: 6, height: 6, borderRadius: 99, background: T.accent, transform: `rotate(${a}deg) translateY(-92px)` }} />
        ))}
      </div>
      <div style={{ position: 'relative', fontFamily: T.fm, fontSize: 9, color: T.accent, letterSpacing: '.18em', textTransform: 'uppercase' }}>● Hype Cast · Verified</div>
      <h1 style={{ position: 'relative', fontFamily: T.fs, fontStyle: 'italic', fontWeight: 400, fontSize: 40, letterSpacing: '-.02em', margin: '14px 0 0', lineHeight: 1 }}>
        You hyped<br/>
        <span style={{ fontFamily: T.fd, fontStyle: 'normal', fontWeight: 800, color: T.accent }}>{track.title}.</span>
      </h1>
      <p style={{ position: 'relative', fontFamily: T.fb, fontSize: 13, color: T.ink2, marginTop: 14, maxWidth: 280, lineHeight: 1.5 }}>
        1 of <strong style={{ color: T.ink }}>389</strong> real fans behind {track.artistName} this week. It just moved up the chart.
      </p>
      <div style={{ position: 'relative', display: 'flex', gap: 10, marginTop: 26 }}>
        <button onClick={onDone} style={{ padding: '12px 18px', background: T.bg2, color: T.ink, border: `1px solid ${T.line2}`, borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Keep listening</button>
        <button onClick={onDone} style={{ padding: '12px 18px', background: T.accent, color: T.bg, border: 'none', borderRadius: 99, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>See the chart →</button>
      </div>
    </div>
  );
}
