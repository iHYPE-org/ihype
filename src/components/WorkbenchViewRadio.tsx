'use client';

import React, { useState, memo } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import { DraggableTrack } from '@/components/WorkbenchDragContext';
import {
  type WorkbenchData,
  type View,
  IcBolt,
  IcPlay,
  IcHeart,
  IcDot,
} from '@/components/WorkbenchShell';

// ── View: Radio ────────────────────────────────────────────────
export const ViewRadio = memo(function ViewRadio({ data, setView }: { data: WorkbenchData; setView: (v: View) => void }) {
  const [activeId, setActiveId] = useState(data.radioShows[0]?.id ?? '');
  const { playTrack } = useMediaPlayer();
  const show = data.radioShows.find(r => r.id === activeId) ?? data.radioShows[0];

  if (!show) return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● RADIO</div>
      <h1 className="wb-page-title">Radio</h1>
      <p className="wb-page-sub">No radio shows available yet. Be the first to start one.</p>
    </div>
  );

  const freqs = ['88.3', '94.1', '101.7', '107.9', '104.5'];
  const idx = data.radioShows.findIndex(r => r.id === activeId);

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● ON AIR · {data.radioShows.length} CHANNELS · {data.listeningNow.toLocaleString()} LISTENING NOW</div>
          <h1 className="wb-page-title">Radio</h1>
          <p className="wb-page-sub">Curated shows from promoters, DJs, and artists. No ads, no algorithm — just real people picking music.</p>
        </div>
        <button className="wb-btn-outline" style={{ borderColor: 'var(--wb-accent)', color: 'var(--wb-accent)' }} onClick={() => setView('studio')}>
          <IcBolt s={12} /> Start your show →
        </button>
      </div>

      <div className="wb-radio-body">
        <div className="wb-channels">
          <div className="wb-channels-head">CHANNELS</div>
          {data.radioShows.map(r => (
            <button key={r.id} onClick={() => setActiveId(r.id)} className="wb-channel" style={{
              background: r.id === activeId ? `${r.color}10` : 'transparent',
              borderLeft: `2px solid ${r.id === activeId ? `${r.color}50` : 'transparent'}`,
            }}>
              <div className="wb-c-bar" style={{ background: r.color, opacity: r.live ? 1 : 0.3 }} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="wb-c-name">
                  {r.name}
                  {r.live && <span className="wb-live-dot">● LIVE</span>}
                </div>
                <div className="wb-c-meta">{r.host} · {r.time}</div>
              </div>
              <div className="wb-c-listen">{r.listeners}</div>
            </button>
          ))}
        </div>

        <div className="wb-radio-detail">
          <div className="wb-detail-hero" style={{ background: `linear-gradient(135deg, ${show.color}30 0%, transparent 60%), var(--wb-bg-2)` }}>
            <div className="wb-dh-top">
              {show.live
                ? <span className="wb-on-air"><IcDot c="#ff3e9a" s={8} /> ON AIR · {show.listeners} listening</span>
                : <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', letterSpacing: '.14em' }}>NEXT BROADCAST · {show.next}</span>
              }
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--wb-ink-2)' }}>{freqs[idx] ?? '—'} MHz</span>
            </div>
            <h2 className="wb-dh-title">{show.name}</h2>
            <div className="wb-dh-host">Hosted by <strong>{show.host}</strong> · {show.time}</div>
            <p className="wb-dh-desc">{show.desc}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="wb-btn-prime" style={{ background: show.live ? show.color : 'var(--wb-ink)', color: 'var(--wb-bg)' }}><IcPlay s={12} /> {show.live ? 'Tune in' : 'Archive'}</button>
              <button className="wb-btn-ghost">＋ Subscribe</button>
              <button className="wb-btn-ghost"><IcHeart s={12} c="#ff3e9a" /> Hype show</button>
            </div>
          </div>

          <div className="wb-panel">
            <div className="wb-panel-head">
              <div>
                <div className="wb-panel-title">Set list · this broadcast</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 3 }}>{show.live ? 'Played in the last hour' : 'Played last show'}</div>
              </div>
              <button className="wb-link-btn">Save all to playlist →</button>
            </div>
            <div>
              {data.tracks.slice(0, 6).map((t, i) => {
                const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
                return (
                  <DraggableTrack key={t.id} track={mt} className="wb-q-row" onClick={() => playTrack(mt)}>
                    <div className="wb-q-idx">{String(i + 1).padStart(2, '0')}</div>
                    <div className="wb-q-art-sm" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="wb-q-name">{t.title}</div>
                      <div className="wb-q-artist-sm">{t.artistName} · {t.album}</div>
                    </div>
                    <div className="wb-q-chip">{i === 0 && show.live ? 'NOW' : i < 2 ? 'JUST PLAYED' : `-${i * 4}m`}</div>
                    <div className="wb-q-hype-sm"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
                  </DraggableTrack>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
