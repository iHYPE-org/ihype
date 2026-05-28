'use client';

import React, { memo, useState } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShell';
import { IcBolt, IcDot, IcPlay, IcHeart } from './icons';
import { Panel } from './primitives';

export const ViewRadio = memo(function ViewRadio({ data, onPickTrack }: {
  data: WorkbenchData; onPickTrack: (i: number) => void;
}) {
  const shows = data.radioShows;
  const [activeId, setActiveId] = useState(shows[0]?.id ?? '');
  const [hyped, setHyped] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const show = shows.find(r => r.id === activeId) ?? shows[0];
  const FREQS = ['88.3','94.1','101.7','107.9','104.5','99.5'];
  const showIdx = shows.findIndex(r => r.id === activeId);

  if (!show) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#ff3e9a', marginBottom: 10 }}>● RADIO · iHYPE NETWORK</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Radio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 16 }}>No radio shows yet. Start one in Studio.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#ff3e9a', marginBottom: 10 }}>
            ● ON AIR · {shows.length} CHANNELS · {shows.reduce((a, s) => a + s.listeners, 0).toLocaleString()} LISTENING NOW
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Radio</h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Curated shows from promoters, DJs, and artists. No ads, no algorithm — just real people picking music.</p>
        </div>
        <button style={{ padding: '9px 16px', border: '1px solid var(--accent-2)', color: 'var(--accent-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, background: 'none', cursor: 'pointer' }}>
          <IcBolt s={12} /> Start your show →
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Channels list */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em' }}>CHANNELS</div>
          {shows.map(r => (
            <button key={r.id} onClick={() => setActiveId(r.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderBottom: '1px solid var(--line)', textAlign: 'left', transition: 'background .15s', cursor: 'pointer',
              background: r.id === activeId ? `${r.color}10` : 'transparent',
              borderLeft: `2px solid ${r.id === activeId ? r.color + '50' : 'transparent'}`,
            }}>
              <div style={{ width: 3, height: 32, borderRadius: 2, background: r.color, opacity: r.live ? 1 : .3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                  {r.name}
                  {r.live && <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a', letterSpacing: '.16em', padding: '1px 5px', border: '1px solid rgba(255,62,154,.4)', borderRadius: 3 }}>● LIVE</span>}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{r.host} · {r.time}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)' }}>{r.listeners}</div>
            </button>
          ))}
          <div style={{ padding: '10px 14px', textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em', cursor: 'pointer' }}>+ Add station</span>
          </div>
        </div>

        {/* Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hero */}
          <div style={{ padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 10, background: `linear-gradient(135deg, ${show.color}30 0%, transparent 60%), var(--bg-2)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              {show.live ? (
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid rgba(255,62,154,.3)', borderRadius: 99 }}>
                  <IcDot c="#ff3e9a" s={8} /> ON AIR · {show.listeners} listening
                </span>
              ) : (
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em' }}>
                  NEXT BROADCAST · {show.next}
                </span>
              )}
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--ink-2)' }}>{FREQS[showIdx] ?? '88.3'} MHz</span>
            </div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 34, letterSpacing: '-.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>{show.name}</h2>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.06em', marginTop: 8 }}>Hosted by <strong>{show.host}</strong> · {show.time}</div>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 14, maxWidth: 540, lineHeight: 1.55 }}>{show.desc}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => {
                  // data.radioShows don't embed individual tracks — play the first track
                  // in the global queue. When per-show track lists are available, map
                  // show.tracks[0] to its global index instead.
                  onPickTrack(0);
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700,
                  letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff',
                  background: 'linear-gradient(135deg, var(--accent), var(--pink, #ff3e9a))',
                }}
              >
                ▶ Tune in
              </button>
              <button
                onClick={() => setSubscribed(true)}
                style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', background: 'none', cursor: 'pointer' }}
              >
                {subscribed ? '✓ Subscribed' : '＋ Subscribe'}
              </button>
              <button
                onClick={async () => {
                  setHyped(true);
                  try {
                    const res = await fetch('/api/hype', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ targetType: 'show', targetId: show.id }),
                    });
                    if (!res.ok) setHyped(false);
                  } catch {
                    setHyped(false);
                  }
                }}
                style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, color: hyped ? '#ff3e9a' : 'var(--ink)', background: 'none', cursor: 'pointer' }}
              >
                {hyped ? '♥ Hyped!' : '♥ Hype show'}
              </button>
            </div>
          </div>

          {/* Set list */}
          <Panel title="Set list · this broadcast" link="Save all to playlist →">
            <div style={{ padding: '4px 0' }}>
              {data.tracks.slice(0, 6).map((t, i) => (
                <button key={t.id} onClick={() => onPickTrack(i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderBottom: '1px solid var(--line)', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', width: 22 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ width: 34, height: 34, borderRadius: 4, flexShrink: 0, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{t.title}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{t.artistName} · {t.album}</div>
                  </div>
                  <div style={{ padding: '2px 8px', background: 'var(--bg-3)', borderRadius: 3, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.08em' }}>
                    {i === 0 && show.live ? 'NOW' : i < 2 ? 'JUST PLAYED' : `-${i * 4}m`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 13, color: '#ff3e9a', width: 50, justifyContent: 'flex-end' }}>
                    <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
});
