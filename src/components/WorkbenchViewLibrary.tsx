'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import { DraggableTrack, PlaylistDropZone } from '@/components/WorkbenchDragContext';
import { type WorkbenchData, IcPlay, IcHeart } from '@/components/WorkbenchShell';

// ── View: Library ──────────────────────────────────────────────
export const ViewLibrary = memo(function ViewLibrary({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'saved' | 'discover'>('saved');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { playTrack, currentTrack } = useMediaPlayer();

  const playlists = [
    { n: 'Hyped tracks',      color: '#ff3e9a', count: 247 },
    { n: 'Top 5 — this week', color: '#ff5029', count: 5 },
    { n: 'Writing room',      color: '#b983ff', count: 42 },
    { n: 'Tour van',          color: '#22e5d4', count: 88 },
  ];

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenuId]);

  const MENU_ITEMS = ['Play', 'Shuffle', 'Add to queue', 'Share', 'Rename', 'Delete'];

  function handleMenuItem(item: string) {
    setOpenMenuId(null);
    if ((item === 'Play' || item === 'Shuffle') && data.tracks.length > 0) {
      const tracks = item === 'Shuffle' ? [...data.tracks].sort(() => Math.random() - 0.5) : data.tracks;
      const mt: MediaTrack = { id: tracks[0].id, title: tracks[0].title, artistName: tracks[0].artistName, url: tracks[0].mediaUrl, artistProfileSlug: tracks[0].artistSlug };
      const queue = tracks.map(t => ({ id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug }));
      playTrack(mt, queue);
    }
  }

  return (
    <div className="wb-view-pad">
      <div style={{ marginBottom: 18 }}>
        <div className="wb-eyebrow" style={{ color: '#b983ff' }}>● YOUR SAVED TRACKS · {data.tracks.length} SONGS · PLAYLISTS</div>
        <h1 className="wb-page-title">Library</h1>
        <p className="wb-page-sub">Everything you've hyped, saved, or curated. Your library is yours.</p>
      </div>
      <div className="wb-tabs" style={{ marginBottom: 20 }}>
        {(['saved', 'discover'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} className={`wb-tab${tab === k ? ' wb-tab-active' : ''}`}>
            {k === 'saved' ? 'Saved' : 'Discover'}
          </button>
        ))}
      </div>

      {tab === 'saved' && (
        <>
          <div className="wb-tracks-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
            {playlists.map(p => (
              <PlaylistDropZone key={p.n} name={p.n} style={{ position: 'relative', padding: 14, border: '1px solid var(--wb-line)', borderRadius: 10, background: 'var(--wb-bg-2)', cursor: 'pointer' }}
                onClick={() => setOpenMenuId(openMenuId === p.n ? null : p.n)}>
                <div style={{ aspectRatio: '1', borderRadius: 6, background: `linear-gradient(135deg, ${p.color}, ${p.color}80)`, marginBottom: 10 }} />
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{p.n}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 3 }}>{p.count} tracks</div>
                {openMenuId === p.n && (
                  <div ref={menuRef} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 8, minWidth: 160, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                    {MENU_ITEMS.map(item => (
                      <button key={item} type="button" onClick={e => { e.stopPropagation(); handleMenuItem(item); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontFamily: 'var(--f-m)', fontSize: 12, color: item === 'Delete' ? '#ff5029' : 'var(--wb-ink)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.02em' }}>
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </PlaylistDropZone>
            ))}
          </div>
          <div className="wb-panel">
            <div className="wb-panel-head"><div className="wb-panel-title">Recently played</div><button className="wb-link-btn">See all</button></div>
            <div className="wb-tracks-grid" style={{ padding: '14px 16px' }}>
              {data.tracks.slice(0, 4).map(t => {
                const active = currentTrack?.id === t.id;
                const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
                return (
                  <DraggableTrack key={t.id} track={mt} className="wb-track-card" style={{ borderColor: active ? t.color : 'var(--wb-line)' }} onClick={() => playTrack(mt)}>
                    <div className="wb-track-art" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}>
                      <div className="wb-track-play"><IcPlay s={12} /></div>
                    </div>
                    <div className="wb-track-name">{t.title}</div>
                    <div className="wb-track-artist">{t.artistName}</div>
                  </DraggableTrack>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === 'discover' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="wb-eyebrow" style={{ color: '#ff5029' }}>● HYPED THIS WEEK · CHICAGO IS HOT</div>
            <p className="wb-page-sub">Trending tracks from the artists, venues, and DJs in your scene.</p>
          </div>
          <div className="wb-tracks-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {data.tracks.map(t => {
              const active = currentTrack?.id === t.id;
              const mt: MediaTrack = { id: t.id, title: t.title, artistName: t.artistName, url: t.mediaUrl, artistProfileSlug: t.artistSlug };
              return (
                <DraggableTrack key={t.id} track={mt} className="wb-track-card" style={{ borderColor: active ? t.color : 'var(--wb-line)', padding: 12, borderRadius: 10 }} onClick={() => playTrack(mt)}>
                  <div className="wb-track-art" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, borderRadius: 7 }}>
                    <div className="wb-track-play"><IcPlay s={12} /></div>
                    <div className="wb-track-hype"><IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}</div>
                  </div>
                  <div className="wb-track-name" style={{ fontSize: 14 }}>{t.title}</div>
                  <div className="wb-track-artist">{t.artistName} · {t.duration}</div>
                </DraggableTrack>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
