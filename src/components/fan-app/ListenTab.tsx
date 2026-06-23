'use client';

import { useState } from 'react';
import { useApp } from './context';
import { Seeds } from './Seeds';
import { IHYPE_DATA } from '@/lib/data';
import { track } from '@/lib/analytics';

const SUBS = ['Seeds', 'Search', 'Radio', 'Charts', 'Playlists', 'Following'] as const;
type Sub = typeof SUBS[number];

function SubNav({ sub, setSub }: { sub: string; setSub: (s: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, flexShrink: 0, borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
      {SUBS.map(s => {
        const on = sub === s.toLowerCase();
        return (
          <button key={s} onClick={() => setSub(s.toLowerCase())} style={{ flex: 'none', padding: '10px 12px 8px', borderRadius: 0, border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: on ? 'var(--ink-1)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.04em', fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

function ListenSearch() {
  const { openSheet } = useApp();
  const [q, setQ] = useState('');
  const D = IHYPE_DATA;
  const pool = [
    ...D.seeds.map(s => ({ type: 'Artist', name: s.artist, sub: s.track, tint: s.tint })),
    ...D.shows.map(s => ({ type: 'Show', name: s.title, sub: s.venue, tint: s.tint })),
  ];
  const results = q ? pool.filter(r => (r.name + r.sub).toLowerCase().includes(q.toLowerCase())) : [];

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search artists, DJs, playlists…" style={{ width: '100%', padding: '10px 36px 10px 38px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }} />
        {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 18 }}>×</button>}
      </div>
      {!q && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Trending now</div>
          {D.seeds.map(s => (
            <div key={s.artist} onClick={() => openSheet('artist-profile', { artist: s.artist })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.6rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.tint, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.88rem' }}>{s.artist}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{s.tag}</div>
              </div>
            </div>
          ))}
        </>
      )}
      {results.map((r, i) => (
        <div key={i} onClick={() => r.type === 'Artist' && openSheet('artist-profile', { artist: r.name })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.6rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: r.tint, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: '#fff', fontWeight: 700 }}>{r.type[0]}</div>
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.88rem' }}>{r.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{r.type} · {r.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListenRadio() {
  const { playTrack } = useApp();
  const D = IHYPE_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {D.radioShows.map(rs => (
        <div key={rs.id} style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: rs.tint, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M14.83 9.17a4 4 0 0 1 0 5.66"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M9.17 14.83a4 4 0 0 1 0-5.66"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem' }}>{rs.name}</span>
              {rs.status === 'LIVE' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.6rem', letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,80,41,.15)', color: 'var(--accent)' }}>LIVE</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 2 }}>{rs.host} · {rs.day}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '.78rem', color: 'var(--ink-2)', marginTop: 3 }}>{rs.genre}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-2)', fontWeight: 600 }}>{rs.listeners}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.6rem', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>listening</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListenCharts() {
  const { openSheet } = useApp();
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>HYPE Charts</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>This week</div>
      </div>
      {IHYPE_DATA.charts.map((c, i) => {
        const trend = c.prev > c.rank ? '▲' : c.prev < c.rank ? '▼' : '→';
        const trendColor = c.prev > c.rank ? 'var(--color-success)' : c.prev < c.rank ? 'var(--color-error)' : 'var(--ink-3)';
        const maxH = Math.max(...c.trend);
        return (
          <div key={c.rank} onClick={() => openSheet('artist-profile', { artist: c.artist })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.7rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', animation: `fadeIn .3s ease ${i * .05}s both` }}>
            <div style={{ width: 28, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: i === 0 ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }}>{c.rank}</div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: c.tint, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.88rem' }}>{c.track}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '.78rem', color: 'var(--ink-2)' }}>{c.artist}</div>
            </div>
            {/* Mini sparkline */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, marginRight: 8 }}>
              {c.trend.map((v, j) => (
                <div key={j} style={{ width: 3, height: `${(v / maxH) * 100}%`, borderRadius: 2, background: i === 0 ? 'var(--accent)' : c.tint, opacity: j === c.trend.length - 1 ? 1 : .4 }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', fontWeight: 700, color: trendColor, flexShrink: 0 }}>{trend}</div>
          </div>
        );
      })}
    </div>
  );
}

function ListenPlaylists() {
  const { playTrack } = useApp();
  const D = IHYPE_DATA;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Your Playlists</div>
        <button style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--ink-2)', borderRadius: 8, padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.08em', cursor: 'pointer', textTransform: 'uppercase' }}>+ New</button>
      </div>
      {D.playlists.map(pl => (
        <div key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.65rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${pl.tint} 0%,#0a0805 100%)`, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.88rem' }}>{pl.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{pl.count} tracks · {pl.mins} min · {pl.by}</div>
          </div>
          {pl.auto && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.6rem', letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,80,41,.1)', color: 'var(--accent)' }}>auto</span>}
        </div>
      ))}
    </div>
  );
}

function ListenFollowing() {
  const { openSheet } = useApp();
  const D = IHYPE_DATA;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Following</div>
        <button onClick={() => openSheet('friend-activity')} style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--ink-2)', borderRadius: 8, padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.08em', cursor: 'pointer', textTransform: 'uppercase' }}>Friends</button>
      </div>
      {D.following.map(f => (
        <div key={f.name} onClick={() => openSheet('artist-profile', { artist: f.name })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.6rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: f.tint, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', fontSize: '.9rem' }}>{f.name[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.88rem' }}>{f.name}</span>
              {f.verified && <span style={{ color: '#7fb3ff', fontSize: 12 }}>✓</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{f.role}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListenTab() {
  const [sub, setSub] = useState('seeds');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubNav sub={sub} setSub={setSub} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.15rem 1.5rem' }}>
        {sub === 'seeds' && <Seeds />}
        {sub === 'search' && <ListenSearch />}
        {sub === 'radio' && <ListenRadio />}
        {sub === 'charts' && <ListenCharts />}
        {sub === 'playlists' && <ListenPlaylists />}
        {sub === 'following' && <ListenFollowing />}
      </div>
    </div>
  );
}
