'use client';

import React, { useState, useRef } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { ViewRadio } from './ViewRadio';
import { ViewSeeds } from './ViewSeeds';

// ─── Tabs ─────────────────────────────────────────────────────

type TabId = 'seeds' | 'search' | 'radio' | 'charts' | 'playlists';

const LISTEN_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'search',
    label: 'Search',
    icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>,
  },
  {
    id: 'seeds',
    label: 'Seeds',
    icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/><path d="M12 13v6m-3 3h6"/></svg>,
  },
  {
    id: 'radio',
    label: 'Radio',
    icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v1.5M12 20.5V22M2 12h1.5M20.5 12H22"/></svg>,
  },
  {
    id: 'charts',
    label: 'Charts',
    icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  },
  {
    id: 'playlists',
    label: 'Playlists',
    icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="8" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M11 18V6l10-2v12"/></svg>,
  },
];

// ─── Search Panel ─────────────────────────────────────────────

function SearchPanel({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tracks = data.tracks.filter(t =>
    !q.trim() ? true : t.title.toLowerCase().includes(q.toLowerCase()) || t.artistName.toLowerCase().includes(q.toLowerCase())
  );
  const GENRES = ['Hip-Hop', 'R&B', 'Electronic', 'Indie Rock', 'Jazz', 'Pop', 'Soul', 'Latin', 'Afrobeats', 'Folk', 'Metal', 'Classical'];

  return (
    <div style={{ padding: '12px 22px 20px' }}>
      <div style={{ position: 'relative', maxWidth: 620, marginBottom: 28 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search artists, tracks, playlists…"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box', padding: '13px 16px 13px 48px',
            borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--bg-2)',
            color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 15, outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,80,41,.18)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      {!q.trim() ? (
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>Browse genres</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => { setQ(g); inputRef.current?.focus(); }}
                style={{
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13,
                  border: '1px solid var(--line-2)', background: 'var(--bg-2)',
                  color: 'var(--ink-2)',
                }}
              >{g}</button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>
            {tracks.length} result{tracks.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tracks.map((t, i) => {
              const active = i === currentIdx;
              return (
                <div
                  key={t.id}
                  onClick={() => onPickTrack(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                    borderRadius: 10, cursor: 'pointer',
                    background: active ? 'rgba(255,80,41,.08)' : 'transparent',
                    border: active ? '1px solid rgba(255,80,41,.2)' : '1px solid transparent',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: `linear-gradient(135deg, ${t.color ?? '#ff5029'}, ${t.color ?? '#ff5029'}66)` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{t.artistName}</div>
                  </div>
                  {active && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Playlists Panel ──────────────────────────────────────────

function PlaylistsPanel({ data, onPickTrack }: { data: WorkbenchData; onPickTrack: (i: number) => void }) {
  const playlists = [
    { name: 'Writing Room', count: 42, color: '#b983ff' },
    { name: 'Tour Van', count: 88, color: '#22e5d4' },
    { name: 'HYPEd tracks', count: data.tracks.length, color: '#ff3e9a' },
    { name: 'Saved from Seeds', count: Math.floor(data.tracks.length * 0.4), color: '#ff5029' },
    { name: 'Friday Vibes', count: 24, color: '#ffb84a' },
    { name: 'Late Night', count: 31, color: '#5b8cff' },
  ];
  return (
    <div style={{ padding: '12px 22px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {playlists.map((pl, i) => (
        <div key={pl.name} onClick={() => onPickTrack(i % Math.max(1, data.tracks.length))} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ aspectRatio: '1', background: `linear-gradient(135deg, ${pl.color}, ${pl.color}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="8" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M11 18V6l10-2v12"/>
            </svg>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>{pl.name}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.08em' }}>{pl.count} tracks</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Charts Panel ─────────────────────────────────────────────

const RANK_COLORS = ['var(--accent)', '#ffb84a', '#22e5d4'];

function ChartsPanel({ data, onPickTrack }: { data: WorkbenchData; onPickTrack: (i: number) => void }) {
  const sorted = [...data.tracks].sort((a, b) => b.hypeCount - a.hypeCount).slice(0, 10);
  return (
    <div style={{ padding: '12px 22px 20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map((t, i) => {
          const rank = i + 1;
          const isTop3 = rank <= 3;
          const rankColor = isTop3 ? RANK_COLORS[i] : 'var(--ink-3)';
          return (
            <div
              key={t.id}
              onClick={() => {
                const originalIdx = data.tracks.findIndex(tr => tr.id === t.id);
                if (originalIdx !== -1) onPickTrack(originalIdx);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px',
                borderRadius: 12, cursor: 'pointer',
                background: isTop3 ? `linear-gradient(90deg, ${t.color ?? '#ff5029'}12, transparent)` : 'transparent',
                border: isTop3 ? `1px solid ${t.color ?? '#ff5029'}22` : '1px solid transparent',
                transition: 'background .12s',
              }}
            >
              {/* Rank */}
              <div style={{
                width: 32, textAlign: 'center', flexShrink: 0,
                fontFamily: 'var(--f-d)', fontWeight: 800,
                fontSize: isTop3 ? 20 : 15,
                color: rankColor,
                lineHeight: 1,
              }}>{rank}</div>
              {/* Art */}
              <div style={{
                width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                background: `linear-gradient(135deg, ${t.color ?? '#ff5029'}, ${t.color ?? '#ff5029'}66)`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%)' }} />
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{t.artistName}</div>
              </div>
              {/* Hype count */}
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: isTop3 ? rankColor : 'var(--ink-3)', letterSpacing: '.04em' }}>♥ {t.hypeCount}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function ViewListen({
  data, onPickTrack, currentIdx,
  seedPlaying, setSeedPlaying, onSave,
}: {
  data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number;
  seedPlaying: boolean; setSeedPlaying: (v: boolean) => void; onSave: (idx: number) => void;
}) {
  const [tab, setTab] = useState<TabId>('seeds');

  return (
    <div>
      {/* Header + tab row */}
      <div style={{ padding: '18px 22px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>Listen</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.025em', margin: '0 0 14px', lineHeight: 1 }}>Everything you play.</h1>
        <div style={{ display: 'flex', gap: 2 }}>
          {LISTEN_TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', cursor: 'pointer',
                  background: 'none', border: 'none',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13,
                  transition: 'color .15s, border-color .15s',
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active panel */}
      <div key={tab} style={{ animation: 'listenTabIn .2s ease both' }}>
        {tab === 'search'    && <SearchPanel data={data} onPickTrack={onPickTrack} currentIdx={currentIdx} />}
        {tab === 'seeds'     && <ViewSeeds data={data} seedPlaying={seedPlaying} setSeedPlaying={setSeedPlaying} onSave={onSave} />}
        {tab === 'radio'     && <div style={{ padding: '0 0 8px' }}><ViewRadio data={data} onPickTrack={onPickTrack} /></div>}
        {tab === 'charts'    && <ChartsPanel data={data} onPickTrack={onPickTrack} />}
        {tab === 'playlists' && <PlaylistsPanel data={data} onPickTrack={onPickTrack} />}
      </div>

      <style>{`
        @keyframes listenTabIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
