'use client';

import React, { useState, useRef } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { ViewRadio } from './ViewRadio';
import { ViewLibrary } from './ViewSettings';

function SubTabs({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 32px', marginBottom: 28 }}>
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            padding: '7px 16px', borderRadius: 99, cursor: 'pointer',
            fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13,
            border: o === value ? '1px solid rgba(255,80,41,.35)' : '1px solid var(--line-2)',
            background: o === value ? 'rgba(255,80,41,.12)' : 'transparent',
            color: o === value ? 'var(--ink)' : 'var(--ink-2)',
            transition: 'background .14s, color .14s',
          }}
        >{o}</button>
      ))}
    </div>
  );
}

function SearchPanel({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tracks = data.tracks.filter(t =>
    !q.trim() ? true : t.title.toLowerCase().includes(q.toLowerCase()) || t.artistName.toLowerCase().includes(q.toLowerCase())
  );
  const GENRES = ['Hip-Hop', 'R&B', 'Electronic', 'Indie Rock', 'Jazz', 'Pop', 'Soul', 'Latin', 'Afrobeats', 'Folk', 'Metal', 'Classical'];

  return (
    <div style={{ padding: '0 32px 32px' }}>
      <div style={{ position: 'relative', maxWidth: 620, marginBottom: 32 }}>
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

function PlaylistsPanel({ data }: { data: WorkbenchData }) {
  const playlists = [
    { name: 'Writing Room', count: 42, color: '#b983ff' },
    { name: 'Tour Van', count: 88, color: '#22e5d4' },
    { name: 'HYPEd tracks', count: data.tracks.length, color: '#ff3e9a' },
    { name: 'Saved from Seeds', count: Math.floor(data.tracks.length * 0.4), color: '#ff5029' },
    { name: 'Friday Vibes', count: 24, color: '#ffb84a' },
    { name: 'Late Night', count: 31, color: '#5b8cff' },
  ];
  return (
    <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {playlists.map(pl => (
        <div key={pl.name} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
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

const SUB_TABS = ['Search', 'Playlists', 'Library'];

const HEADERS: Record<string, [string, string]> = {
  Search:    ['Find anything', 'Search artists, tracks & playlists.'],
  Playlists: ['Your playlists', 'Collections you keep on repeat.'],
  Library:   ['Your library', "Every track you've saved."],
};

export function ViewListen({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  const [sub, setSub] = useState('Search');
  const [kicker, title] = HEADERS[sub];

  return (
    <div>
      <div style={{ padding: '32px 32px 20px' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{kicker}</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-.04em', margin: '0 0 20px', lineHeight: 1 }}>{title}</h1>
      </div>
      <SubTabs value={sub} options={SUB_TABS} onChange={setSub} />
      {sub === 'Search' && <SearchPanel data={data} onPickTrack={onPickTrack} currentIdx={currentIdx} />}
      {sub === 'Playlists' && <PlaylistsPanel data={data} />}
      {sub === 'Library' && (
        <div style={{ padding: '0 0 32px' }}>
          <ViewLibrary data={data} onPickTrack={onPickTrack} currentIdx={currentIdx} />
        </div>
      )}
    </div>
  );
}
