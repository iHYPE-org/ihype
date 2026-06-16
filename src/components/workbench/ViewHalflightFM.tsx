'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { WorkbenchData } from '@/types/workbench';

// ── Station definitions ───────────────────────────────────────────────────────
const STATIONS = [
  { freq: 87.3,  label: 'INDIE',     name: 'The Indie Stream',    tagline: 'Real songs from real artists.',   color: '#ff5029', nowTrack: 'Sundown',          nowArtist: 'Maya Reyes' },
  { freq: 94.1,  label: 'VENUES',    name: 'Live from the Floor', tagline: 'Direct from the stage.',          color: '#22e5d4', nowTrack: 'Halflight',        nowArtist: 'Maya Reyes' },
  { freq: 101.7, label: 'DISCOVER',  name: 'New This Week',       tagline: 'Freshest seeds in the city.',     color: '#b983ff', nowTrack: 'Riverside Memory', nowArtist: 'Colin Atwood' },
  { freq: 107.9, label: 'PROMOTERS', name: 'Curated Radio',       tagline: 'Your scene, promoted.',           color: '#ff3e9a', nowTrack: 'Cobalt Hour',      nowArtist: 'Vela' },
] as const;

type Station = typeof STATIONS[number];

const MIN_FREQ = 87.0;
const MAX_FREQ = 108.0;
const FREQ_RANGE = MAX_FREQ - MIN_FREQ;

function freqToPercent(f: number) { return (f - MIN_FREQ) / FREQ_RANGE * 100; }
function snapToNearest(f: number): Station {
  return STATIONS.reduce((best, s) => Math.abs(s.freq - f) < Math.abs(best.freq - f) ? s : best);
}

// ── VU Meter ─────────────────────────────────────────────────────────────────
function VuMeter({ active, color }: { active: boolean; color: string }) {
  const bars = 12;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} style={{
          width: 5, borderRadius: 2,
          background: active ? (i > 9 ? '#ff3e9a' : i > 7 ? '#ffb84a' : color) : 'var(--line)',
          height: active ? `${30 + Math.sin(i * 1.3) * 50 + 20}%` : '20%',
          transition: `height ${0.1 + i * 0.02}s ease`,
          animation: active ? `vuBar${(i % 4) + 1} ${0.4 + (i % 5) * 0.08}s ease-in-out infinite alternate` : 'none',
        }} />
      ))}
    </div>
  );
}

// ── Hype button ───────────────────────────────────────────────────────────────
function HypeButton({ color, onHype }: { color: string; onHype: () => void }) {
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  function handleHype() {
    const next = count + 1;
    setCount(next);
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    onHype();
  }
  const label = count >= 15 ? 'LEGENDARY' : count >= 5 ? 'MAXED' : 'HYPE IT';
  return (
    <button onClick={handleHype} style={{
      padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontFamily: 'var(--f-m)', fontSize: 14, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#fff',
      background: flash ? '#fff' : `linear-gradient(135deg, ${color}, ${color}aa)`,
      boxShadow: `0 4px 24px ${color}55`,
      transition: 'background .15s, transform .1s',
      transform: flash ? 'scale(1.06)' : 'scale(1)',
    }}>
      {label} {count > 0 && `+${count}`}
    </button>
  );
}

// ── Dial knob ─────────────────────────────────────────────────────────────────
function TuneKnob({ freq, onChange }: { freq: number; onChange: (f: number) => void }) {
  const dragRef = useRef<{ startY: number; startFreq: number } | null>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startFreq: freq };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (dragRef.current.startY - ev.clientY) / 200 * FREQ_RANGE;
      onChange(Math.max(MIN_FREQ, Math.min(MAX_FREQ, dragRef.current.startFreq + delta)));
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, [freq, onChange]);
  const rotation = ((freq - MIN_FREQ) / FREQ_RANGE) * 270 - 135;
  return (
    <div onMouseDown={handleMouseDown} style={{
      width: 72, height: 72, borderRadius: '50%', cursor: 'ns-resize', userSelect: 'none',
      background: 'radial-gradient(circle at 35% 35%, #3a3228, #1a1410)',
      border: '2px solid #3a3228', boxShadow: '0 4px 16px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <div style={{ position: 'absolute', width: 4, height: 24, top: 8, left: '50%', marginLeft: -2, background: '#22e5d4', borderRadius: 99, transformOrigin: 'bottom center', transform: `rotate(${rotation}deg)`, transition: 'transform .05s' }} />
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: 32 }}>TUNE</div>
    </div>
  );
}

// ── Station presets ───────────────────────────────────────────────────────────
function StationPresets({ active, onSelect }: { active: Station; onSelect: (s: Station) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {STATIONS.map(s => (
        <button key={s.freq} onClick={() => onSelect(s)} style={{
          padding: '8px 10px', borderRadius: 7, border: `1px solid ${active.freq === s.freq ? s.color + '88' : 'var(--line)'}`,
          background: active.freq === s.freq ? `${s.color}18` : 'var(--bg-3)', cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: s.color, letterSpacing: '.1em', fontWeight: 700 }}>{s.freq} {s.label}</div>
          <div style={{ fontFamily: 'var(--f-b)', fontSize: 11, color: 'var(--ink-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
        </button>
      ))}
    </div>
  );
}

// ── Desktop view ──────────────────────────────────────────────────────────────
export function ViewHalflightFM({ data }: { data: WorkbenchData }) {
  void data;
  const [rawFreq, setRawFreq] = useState(87.3);
  const [station, setStation] = useState<Station>(STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [hyped, setHyped] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStation(snapToNearest(rawFreq)), 120);
    return () => clearTimeout(t);
  }, [rawFreq]);

  function selectStation(s: Station) { setRawFreq(s.freq); setStation(s); }

  async function handleHype() {
    setHyped(h => h + 1);
    try { await fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'station', targetId: station.label }) }); }
    catch { /* best effort */ }
  }

  const accentColor = station.color;

  return (
    <div style={{ padding: '28px 32px 40px' }}>
      <style>{`
        @keyframes vuBar1 { 0% { height: 20%; } 100% { height: 80%; } }
        @keyframes vuBar2 { 0% { height: 40%; } 100% { height: 95%; } }
        @keyframes vuBar3 { 0% { height: 30%; } 100% { height: 70%; } }
        @keyframes vuBar4 { 0% { height: 50%; } 100% { height: 100%; } }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: accentColor, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentColor, animation: 'pulse 1.4s ease-in-out infinite' }} />
          ON AIR · HALFLIGHT FM · {STATIONS.length} STATIONS LIVE
        </div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Halflight FM</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>
          Spin the dial. Find your scene. One station, every role — indie artists, the venues that host them, the promoters who push them. No algorithm. No labels.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start', marginBottom: 32 }}>
        {/* Left: CRT + controls */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--bg-2)', padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* CRT screen */}
          <div style={{ background: '#0a0d08', border: '1px solid #2a2a1a', borderRadius: 10, padding: '18px 20px', position: 'relative', overflow: 'hidden', minHeight: 140 }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.15) 2px, rgba(0,0,0,.15) 4px)', pointerEvents: 'none', zIndex: 1 }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 32, letterSpacing: '.08em', color: '#ffb84a', fontWeight: 700, textShadow: `0 0 20px #ffb84a88` }}>{rawFreq.toFixed(1)} MHz</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: accentColor, letterSpacing: '.18em', textTransform: 'uppercase', marginTop: 6, textShadow: `0 0 12px ${accentColor}88` }}>{station.label} · {station.name}</div>
              <div style={{ fontFamily: 'var(--f-b)', fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>{station.tagline}</div>
            </div>
          </div>

          {/* Frequency tape */}
          <div style={{ position: 'relative', height: 40 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-3)', borderRadius: 6, overflow: 'hidden' }}>
              {Array.from({ length: 22 }, (_, i) => {
                const f = 87 + i;
                return (
                  <div key={f} style={{ position: 'absolute', left: `${freqToPercent(f)}%`, top: 0, bottom: 0, width: 1, background: 'var(--line)', opacity: 0.5 }}>
                    <span style={{ position: 'absolute', bottom: 2, left: 2, fontFamily: 'var(--f-m)', fontSize: 8, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{f}</span>
                  </div>
                );
              })}
              {STATIONS.map(s => (
                <button key={s.freq} onClick={() => selectStation(s)} style={{ position: 'absolute', left: `${freqToPercent(s.freq)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer', background: s.color, boxShadow: `0 0 8px ${s.color}`, padding: 0 }} />
              ))}
              <div style={{ position: 'absolute', left: `${freqToPercent(rawFreq)}%`, top: 0, bottom: 0, width: 2, background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,.8)', transform: 'translateX(-50%)', transition: 'left .08s' }} />
            </div>
          </div>

          {/* Now playing + VU */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>NOW PLAYING</div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{station.nowTrack}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{station.nowArtist}</div>
            </div>
            <VuMeter active={playing} color={accentColor} />
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setPlaying(p => !p)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', background: playing ? 'rgba(255,255,255,.08)' : `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`, color: playing ? 'var(--ink)' : '#fff' }}>
              {playing ? '⏸ Pause' : '▶ Listen'}
            </button>
            <HypeButton color={accentColor} onHype={handleHype} />
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>
              SIGNAL <span style={{ color: accentColor }}>{Math.round(84 + Math.sin(rawFreq) * 8)}</span>
              {' · '}HYPE <span style={{ color: '#ff3e9a' }}>{42 + hyped}</span>
            </div>
          </div>
        </div>

        {/* Right: Knob + presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--bg-2)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>TUNE</div>
            <TuneKnob freq={rawFreq} onChange={setRawFreq} />
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5 }}>Drag up/down to tune<br />or click a preset below</div>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--bg-2)', padding: '16px 16px 18px' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>PRESETS</div>
            <StationPresets active={station} onSelect={selectStation} />
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { role: 'FOR ARTISTS', headline: 'Get spun. Get paid.', body: '45% of revenue lands in your account. Auto-split, every play. Upload once, earn forever.', cta: 'Upload a track →', color: '#22e5d4' },
          { role: 'FOR PROMOTERS', headline: 'Build your own station.', body: 'Drag hyped tracks, drop voice overs, sprinkle 5-second samples. Publish in under 10 minutes.', cta: 'Open the Studio →', color: '#ff3e9a' },
          { role: 'FOR FANS', headline: 'Listen, then show up.', body: 'Tracks you Hype climb the charts. Artists you love show up in your feed when they book a venue near you.', cta: 'Start listening →', color: '#b983ff' },
        ].map(card => (
          <div key={card.role} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '20px 20px 18px' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: card.color, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{card.role}</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.2 }}>{card.headline}</div>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>{card.body}</p>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: card.color, marginTop: 14, letterSpacing: '.06em', cursor: 'pointer' }}>{card.cta}</div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div style={{ marginTop: 28, display: 'flex', gap: 32, justifyContent: 'center', borderTop: '1px solid var(--line)', paddingTop: 24 }}>
        {[
          { label: 'STATIONS LIVE', value: '4' },
          { label: 'LISTENING NOW', value: (1284 + hyped * 2).toLocaleString() },
          { label: 'PLATFORM FEE', value: '0%' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', color: 'var(--ink)' }}>{s.value}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mobile compact view ───────────────────────────────────────────────────────
export function ViewHalflightFMMobile({ data }: { data: WorkbenchData }) {
  void data;
  const [station, setStation] = useState<Station>(STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [hyped, setHyped] = useState(0);

  async function handleHype() {
    setHyped(h => h + 1);
    try { await fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'station', targetId: station.label }) }); }
    catch { /* best effort */ }
  }

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <style>{`
        @keyframes vuBar1 { 0% { height: 20%; } 100% { height: 80%; } }
        @keyframes vuBar2 { 0% { height: 40%; } 100% { height: 95%; } }
        @keyframes vuBar3 { 0% { height: 30%; } 100% { height: 70%; } }
        @keyframes vuBar4 { 0% { height: 50%; } 100% { height: 100%; } }
      `}</style>

      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: station.color, marginBottom: 8, textTransform: 'uppercase' }}>● HALFLIGHT FM · ON AIR</div>
      <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.025em', margin: '0 0 16px', color: 'var(--ink)' }}>Halflight FM</h2>

      {/* Now playing card */}
      <div style={{ background: `linear-gradient(135deg, ${station.color}20, var(--bg-2))`, border: '1px solid var(--line)', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: station.color, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 6 }}>NOW PLAYING</div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>{station.nowTrack}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{station.nowArtist}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <button onClick={() => setPlaying(p => !p)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, background: playing ? 'rgba(255,255,255,.1)' : station.color, color: '#fff' }}>
            {playing ? '⏸ Pause' : '▶ Listen'}
          </button>
          <button onClick={handleHype} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${station.color}55`, cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, background: 'none', color: station.color }}>
            ♥ HYPE{hyped > 0 ? ` +${hyped}` : ''}
          </button>
        </div>
      </div>

      {/* Station switcher */}
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>STATIONS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STATIONS.map(s => (
          <button key={s.freq} onClick={() => setStation(s)} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            background: station.freq === s.freq ? `${s.color}14` : 'var(--bg-2)',
            border: `1px solid ${station.freq === s.freq ? s.color + '55' : 'var(--line)'}`,
            borderRadius: 10, cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${s.color}cc, ${s.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: '#fff', fontWeight: 700, letterSpacing: '.06em' }}>{s.freq}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: s.color, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginTop: 1 }}>{s.name}</div>
            </div>
            {station.freq === s.freq && <VuMeter active={playing} color={s.color} />}
          </button>
        ))}
      </div>

      {/* Info */}
      <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: '#22e5d4', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>0% PLATFORM FEE · ALWAYS</div>
        <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>45% to artists · 45% to the curator · 10% to referrers. iHYPE takes nothing.</div>
      </div>
    </div>
  );
}
