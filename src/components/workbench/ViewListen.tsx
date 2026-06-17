'use client';

import React, { useState, useRef } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { ViewRadio } from './ViewRadio';

// ─── Accordion ───────────────────────────────────────────────

type SectionId = 'Search' | 'Playlists' | 'Radio' | 'Charts';

const SECTIONS: { id: SectionId; icon: React.ReactNode; title: string; sub: string }[] = [
  {
    id: 'Search',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
      </svg>
    ),
    title: 'Search',
    sub: 'Find artists, tracks & playlists',
  },
  {
    id: 'Playlists',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="8" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M11 18V6l10-2v12"/>
      </svg>
    ),
    title: 'Playlists',
    sub: 'Collections you keep on repeat',
  },
  {
    id: 'Radio',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v1.5M12 20.5V22M2 12h1.5M20.5 12H22"/>
      </svg>
    ),
    title: 'Radio',
    sub: 'Artist-curated, on air now',
  },
  {
    id: 'Charts',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/><path d="M12 13v6m-3 3h6"/>
      </svg>
    ),
    title: 'Charts',
    sub: 'What your city is hyping',
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
    <div style={{ padding: '20px 32px 28px' }}>
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
    <div style={{ padding: '20px 32px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
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

// ─── Charts Panel ─────────────────────────────────────────────

const RANK_COLORS = ['var(--accent)', '#ffb84a', '#22e5d4'];

function ChartsPanel({ data, onPickTrack }: { data: WorkbenchData; onPickTrack: (i: number) => void }) {
  const sorted = [...data.tracks].sort((a, b) => b.hypeCount - a.hypeCount).slice(0, 10);
  return (
    <div style={{ padding: '20px 32px 28px' }}>
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

// ─── Accordion Item ───────────────────────────────────────────

function AccordionItem({
  section,
  isOpen,
  onToggle,
  children,
}: {
  section: typeof SECTIONS[0];
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${isOpen ? 'var(--line-2)' : 'var(--line)'}`,
      background: isOpen ? 'var(--bg-3)' : 'var(--bg-2)',
      overflow: 'hidden',
      transition: 'background .14s, border-color .14s',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 20px', cursor: 'pointer', background: 'none', border: 'none',
          textAlign: 'left',
        }}
      >
        {/* Icon container */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: isOpen ? 'rgba(255,80,41,.14)' : 'rgba(255,255,255,.04)',
          color: isOpen ? 'var(--accent)' : 'var(--ink-3)',
          transition: 'background .14s, color .14s',
        }}>
          {section.icon}
        </div>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink)', lineHeight: 1 }}>{section.title}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.72rem', color: 'var(--ink-3)', marginTop: 3 }}>{section.sub}</div>
        </div>
        {/* Chevron */}
        <svg
          width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s' }}
        >
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>

      {/* Content — animates via max-height trick */}
      {isOpen && (
        <div style={{ animation: 'accordionFadeIn .18s ease' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function ViewListen({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  const [openSection, setOpenSection] = useState<SectionId>('Search');

  return (
    <div>
      {/* Static header */}
      <div style={{ padding: '32px 32px 24px' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Listen</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-.04em', margin: '0 0 0', lineHeight: 1 }}>Everything you play.</h1>
      </div>

      {/* Accordion */}
      <div style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SECTIONS.map(section => (
          <AccordionItem
            key={section.id}
            section={section}
            isOpen={openSection === section.id}
            onToggle={() => setOpenSection(section.id)}
          >
            {section.id === 'Search' && <SearchPanel data={data} onPickTrack={onPickTrack} currentIdx={currentIdx} />}
            {section.id === 'Playlists' && <PlaylistsPanel data={data} />}
            {section.id === 'Radio' && (
              <div style={{ padding: '0 0 8px' }}>
                <ViewRadio data={data} onPickTrack={onPickTrack} />
              </div>
            )}
            {section.id === 'Charts' && <ChartsPanel data={data} onPickTrack={onPickTrack} />}
          </AccordionItem>
        ))}
      </div>

      <style>{`
        @keyframes accordionFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
