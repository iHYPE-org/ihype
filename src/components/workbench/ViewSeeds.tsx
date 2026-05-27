'use client';

import React, { useEffect, useState } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShell';
import { SeedsGamifiedView } from '@/components/SeedsGamifiedView';
import { IcPlay, IcPause } from './icons';

export function ViewSeeds({
  data,
  seedPlaying,
  setSeedPlaying,
  seedCardIdx,
  onSave,
}: {
  data: WorkbenchData;
  seedPlaying: boolean;
  setSeedPlaying: (v: boolean) => void;
  seedCardIdx: number;
  onSave?: (idx: number) => void;
}) {
  const waveHeights = [30,55,80,42,90,70,48,88,62,35,78,55,92,40,68,82,48,30,62,88];
  // SeedsGamifiedView is kept for future embedded use
  void SeedsGamifiedView;

  const SEEN_KEY = 'ihype-seeds-seen-v1';

  function loadSeen(): string[] {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; }
  }
  function saveSeen(ids: string[]) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200))); } catch {} // keep last 200
  }

  const [discoveryTracks, setDiscoveryTracks] = useState<WorkbenchData['tracks']>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [hypedIds, setHypedIds] = useState<Set<string>>(new Set());
  const [seenIds, setSeenIds] = useState<string[]>([]);

  useEffect(() => { setSeenIds(loadSeen()); }, []);

  useEffect(() => {
    fetch(`/api/discover/tracks?seen=${seenIds.join(',')}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const tracks = d?.tracks ?? [];
        if (tracks.length > 0) setDiscoveryTracks(tracks);
      })
      .catch(() => {})
      .finally(() => setLoadingDiscover(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markSeen = (id: string) => {
    setSeenIds(prev => {
      const next = [...prev, id];
      saveSeen(next);
      return next;
    });
  };

  const handleHype = async (trackId: string) => {
    if (hypedIds.has(trackId)) return;
    setHypedIds(prev => new Set([...prev, trackId]));
    markSeen(trackId);
    // TODO: wire to show hype once track→show mapping is available
    // The /api/hype endpoint expects { targetType: 'show'|'profile', targetId: cuid }
    // Discovery tracks from /api/discover/tracks are media assets, so we use targetType: 'profile'
    try {
      await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'profile', targetId: trackId }),
      });
    } catch {
      setHypedIds(prev => { const n = new Set(prev); n.delete(trackId); return n; });
    }
  };

  // Determine which track to show on the front card
  const seedTracks = discoveryTracks.length > 0 ? discoveryTracks : data.tracks;
  const frontTrack = seedTracks.length > 0 ? seedTracks[seedCardIdx % seedTracks.length] : null;

  // Web Audio API tone generator (220Hz sine, 0.08 gain, 15s)
  useEffect(() => {
    if (!seedPlaying) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 15);
    const timer = setTimeout(() => setSeedPlaying(false), 15000);
    return () => {
      clearTimeout(timer);
      try { osc.stop(); } catch {}
      ctx.close();
    };
  }, [seedPlaying, setSeedPlaying]);

  return (
    <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>
      {/* View head */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>DISCOVER · 15–30s clips · Chicago</div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 38, letterSpacing: '-.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Seeds <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-2)' }}>— decide in 15 seconds.</em></h1>
          <p style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 8, maxWidth: '60ch' }}>Hand-cut hooks from new uploads. Save it, hype it, skip it. Save-rate becomes the algorithm.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-2)', border: '1px solid transparent', background: 'none' }}>⚙ Filters</button>
          <button style={{ padding: '8px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-2)', border: '1px solid transparent', background: 'none' }}>Local · Chicago ▾</button>
        </div>
      </div>

      {/* 3-col seeds stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px 1fr', gap: 30, alignItems: 'flex-start', paddingTop: 8 }}>

        {/* Left col */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>TODAY&apos;S DECK</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
            {[
              { k: 'Reviewed', v: '4 / 12', c: 'var(--ink)' },
              { k: 'Saved', v: '+3', c: '#22e5d4' },
              { k: 'Skipped', v: '1', c: '#ff6b5a' },
              { k: 'Hyped', v: '2', c: 'var(--pink)' },
            ].map(r => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontFamily: 'var(--f-m)', fontSize: 11 }}>
                <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>{r.k}</span>
                <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--f-m)', fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}>XP earned</span>
              <span style={{ color: '#ffb84a', fontWeight: 600 }}>+42 XP</span>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 18, marginBottom: 4 }}>DAILY QUEST</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14 }}>Save 5 seeds today</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[true,true,true,false,false].map((filled, i) => (
                <span key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: filled ? 'var(--accent)' : 'var(--bg-3)' }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>3 / 5 · 60 XP + Seed Curator badge</div>
          </div>
        </aside>

        {/* Center col — card stack + controls */}
        <div>
          {loadingDiscover && discoveryTracks.length === 0 ? (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 13 }}>
              Loading seeds…
            </div>
          ) : seedTracks.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: 380, gap: 16, textAlign: 'center'
            }}>
              <div style={{ fontSize: 48 }}>🌱</div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>No seeds yet</div>
              <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '28ch', lineHeight: 1.5 }}>
                No new uploads in your area. Check back soon or widen your city filter.
              </div>
              <button style={{
                marginTop: 8, padding: '10px 20px', borderRadius: 8,
                fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.08em',
                textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff',
                background: 'linear-gradient(135deg, var(--accent), var(--pink))'
              }}>Widen Filter</button>
            </div>
          ) : (<>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '380/520', margin: '0 auto' }}>
            {/* behind-2 */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', transformOrigin: 'center bottom', transform: 'translateY(26px) scale(.88)', opacity: .28, zIndex: 0, background: 'linear-gradient(135deg, #22e5d4, #7fb3ff)' }} />
            {/* behind-1 */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', transformOrigin: 'center bottom', transform: 'translateY(14px) scale(.94)', opacity: .55, zIndex: 1, background: 'linear-gradient(135deg, #b983ff, #ff3e9a)' }} />
            {/* front card */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', zIndex: 5 }}>
              {/* Art bg */}
              <div style={{ position: 'absolute', inset: 0, background: frontTrack ? `linear-gradient(135deg, ${frontTrack.color} 0%, #ff3e9a 60%, #221c16 100%)` : 'linear-gradient(135deg, #ff5029 0%, #ff3e9a 60%, #221c16 100%)' }} />
              {/* Overlay gradient */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.75) 100%)' }} />
              {/* Playing indicator */}
              {seedPlaying && (
                <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 10, padding: '5px 12px', borderRadius: 99, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: '#22e5d4', animation: 'pulse 1.4s infinite', whiteSpace: 'nowrap' }}>
                  ● PLAYING
                </div>
              )}
              {/* Tags */}
              <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', gap: 8, zIndex: 3 }}>
                <span style={{ padding: '5px 10px', borderRadius: 99, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)', fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.14em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />SEED · 22s
                </span>
                <span style={{ padding: '5px 10px', borderRadius: 99, background: 'rgba(255,255,255,.18)', fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.14em', fontWeight: 700, color: '#fff' }}>CHICAGO</span>
              </div>
              {/* Waveform */}
              <div style={{ position: 'absolute', bottom: 170, left: 24, right: 24, height: 36, display: 'flex', alignItems: 'flex-end', gap: 3, zIndex: 3 }}>
                {waveHeights.map((h, i) => (
                  <i key={i} style={{ flex: 1, background: seedPlaying ? 'rgba(34,229,212,.8)' : 'rgba(255,255,255,.55)', borderRadius: 99, display: 'block', height: `${h}%`, transition: 'background .3s' }} />
                ))}
              </div>
              {/* Body */}
              <div style={{ position: 'absolute', bottom: 60, left: 22, right: 22, zIndex: 3, color: '#fff' }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-.03em', lineHeight: .95, textShadow: '0 2px 12px rgba(0,0,0,.4)' }}>{frontTrack ? frontTrack.title : 'Slow Burn'}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'rgba(255,255,255,.8)', letterSpacing: '.1em', marginTop: 6, textTransform: 'uppercase' }}>{frontTrack ? `${frontTrack.artistName} · ${frontTrack.album}` : 'The Lowriders · Side Roads'}</div>
                <div style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontSize: 16, color: 'rgba(255,255,255,.9)', marginTop: 14, lineHeight: 1.35, borderLeft: '2px solid var(--accent)', paddingLeft: 10 }}>&ldquo;It only really lands at 1:48 — that&apos;s the seed.&rdquo;</div>
              </div>
              {/* Footer */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,.08)', fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.08em', color: 'rgba(255,255,255,.7)' }}>
                <span>♥ {frontTrack ? frontTrack.hypeCount : 211} hype</span>
                <span>48 saves · 21 skips</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 24 }}>
            <button title="Skip (ArrowLeft)" aria-label="Skip seed" onClick={() => frontTrack && markSeen(frontTrack.id)} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid rgba(255,107,90,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ff6b5a' }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
            <button title="Play/Pause (Space)" aria-label={seedPlaying ? 'Pause' : 'Play'} onClick={() => setSeedPlaying(!seedPlaying)} style={{ width: 56, height: 56, borderRadius: '50%', background: seedPlaying ? 'rgba(34,229,212,.1)' : 'var(--bg-2)', border: `1px solid ${seedPlaying ? 'rgba(34,229,212,.6)' : 'var(--line-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: seedPlaying ? '#22e5d4' : 'var(--ink-2)' }}>
              {seedPlaying ? <IcPause s={20} /> : <IcPlay s={20} />}
            </button>
            <button title="Save — loads into dock (ArrowUp)" aria-label="Save seed to queue" onClick={() => { onSave?.(seedCardIdx % Math.max(seedTracks.length, 1)); if (frontTrack) markSeen(frontTrack.id); }} style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid rgba(34,229,212,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#22e5d4' }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l14 7-14 7V5z" fill="currentColor" opacity=".2"/><path d="M5 5l14 7-14 7V5z"/></svg>
            </button>
            <button
              title="HYPE it (ArrowRight)"
              aria-label="Hype this track"
              onClick={() => frontTrack && handleHype(frontTrack.id)}
              style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-2)',
                border: `1px solid ${frontTrack && hypedIds.has(frontTrack.id) ? 'rgba(255,62,154,.8)' : 'rgba(255,62,154,.4)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                color: frontTrack && hypedIds.has(frontTrack.id) ? '#ff3e9a' : 'var(--pink)',
              }}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" fill={frontTrack && hypedIds.has(frontTrack.id) ? '#ff3e9a' : 'currentColor'}>
                <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginTop: 14, textTransform: 'uppercase' }}>← Skip · ↑ Save · → Hype · Space Play/Pause</div>
          </>)}
        </div>

        {/* Right col */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>UP NEXT</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { title: 'Cassette Heart', artist: 'Juno North', dur: '24s', grad: 'linear-gradient(135deg,#b983ff,#7fb3ff)', op: 1 },
              { title: 'Halflight', artist: 'Maya Reyes', dur: '20s', grad: 'linear-gradient(135deg,#22e5d4,#b983ff)', op: 1 },
              { title: 'Underpass', artist: 'Saint Hex', dur: '27s', grad: 'linear-gradient(135deg,#7fb3ff,#ff5029)', op: 0.6 },
            ].map(t => (
              <div key={t.title} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 10, alignItems: 'center', opacity: t.op }}>
                <div style={{ width: 42, height: 42, borderRadius: 6, background: t.grad }} />
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13 }}>{t.title}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>{t.artist} · {t.dur}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 18, marginBottom: 4 }}>WHY THIS SEED?</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, fontFamily: 'var(--f-b)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            You hyped <span style={{ color: 'var(--accent)', fontWeight: 600 }}>3 tracks</span> from The Lowriders this month. This is from their unreleased EP <em style={{ fontFamily: "'Instrument Serif',serif" }}>&ldquo;Side Roads&rdquo;</em> — promoter test pressing.
          </div>
        </aside>

      </div>
    </div>
  );
}
