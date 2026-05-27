'use client';

import React from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShell';
import { IcHeart } from './icons';
import { Panel } from './primitives';

export function ViewStudio({ data }: { data: WorkbenchData }) {
  const payout = data.lifeStats?.totalEarnings ?? 0;
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● STUDIO · SHOW CREATOR · UPLOADS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Studio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Upload tracks, build radio shows, track payouts. 45% of every ticket to you, always.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Uploads">
          <div style={{ padding: '4px 0' }}>
            {data.tracks.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '40px 24px', gap: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 40 }}>🎵</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>No uploads yet</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '24ch', lineHeight: 1.5 }}>
                  Drag an audio file here or click to upload your first track.
                </div>
                <button style={{
                  marginTop: 4, padding: '11px 24px', borderRadius: 9,
                  fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff',
                  background: 'linear-gradient(135deg, var(--accent), var(--pink, #ff3e9a))',
                }}>Upload a track</button>
              </div>
            ) : (
              data.tracks.slice(0, 4).map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 5, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t.title}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t.artistName} · {t.duration}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 13, color: '#ff3e9a' }}>
                    <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '24px 28px' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.16em', color: 'var(--ink-3)', marginBottom: 8 }}>PAYOUT PENDING</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.025em', color: 'var(--ink)' }}>${payout.toLocaleString()}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: '#ffb84a', letterSpacing: '.04em', marginTop: 6 }}>pending · next release</div>
          <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.04em' }}>
            45% tickets · 45% venue · 10% referrer · $0 platform fee
          </div>
          <button style={{ marginTop: 14, width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>
            + New show
          </button>
        </div>
      </div>
    </div>
  );
}
