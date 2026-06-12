'use client';
import React, { useState, useEffect } from 'react';
import type { WorkbenchData } from '@/types/workbench';

type DiscoverProfile = {
  id: string; slug: string; name: string; type: string;
  city: string | null; stateRegion: string | null; hypeCount: number;
  genres: string[]; avatarImage: string | null;
};

type DiscoverData = { artists: DiscoverProfile[]; venues: DiscoverProfile[]; djs: DiscoverProfile[] };

function ProfileCard({ p }: { p: DiscoverProfile }) {
  const [hyped, setHyped] = useState(false);
  const [hypeCount, setHypeCount] = useState(p.hypeCount);
  const [followed, setFollowed] = useState(false);
  const location = [p.city, p.stateRegion].filter(Boolean).join(', ') || 'Unknown';
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{
        height: 80, background: p.avatarImage
          ? `url(${p.avatarImage}) center/cover`
          : 'linear-gradient(135deg,rgba(255,80,41,.25),rgba(255,62,154,.15))',
      }} />
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,.06)', color: 'var(--ink-3)' }}>{p.type}</span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)' }}>{location}</span>
        </div>
        {p.genres.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {p.genres.slice(0, 3).map(g => (
              <span key={g} style={{ fontFamily: 'var(--f-m)', fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(185,131,255,.12)', color: '#b983ff', border: '1px solid rgba(185,131,255,.2)' }}>{g}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{hypeCount.toLocaleString()} hypes</div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={() => {
                if (hyped) return;
                setHyped(true); setHypeCount(c => c + 1);
                fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'profile', targetId: p.id }) }).catch(() => {});
              }}
              style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, fontFamily: 'var(--f-b)', border: hyped ? '1px solid transparent' : '1px solid rgba(255,80,41,.5)', background: hyped ? 'linear-gradient(135deg,#ff5029,#ff3e9a)' : 'rgba(255,80,41,.1)', color: hyped ? '#fff' : 'var(--accent)', cursor: 'pointer', minHeight: 'unset' }}
            >
              {hyped ? '⚡ Hyped' : '⚡ Hype'}
            </button>
            <button
              onClick={() => {
                if (followed) return;
                setFollowed(true);
                fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: p.id }) }).catch(() => {});
              }}
              style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, fontFamily: 'var(--f-b)', border: '1px solid rgba(34,229,212,.4)', background: 'rgba(34,229,212,.08)', color: followed ? 'rgba(34,229,212,.45)' : '#22e5d4', cursor: 'pointer', minHeight: 'unset' }}
            >
              {followed ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViewDiscover({ data: _data }: { data: WorkbenchData }) {
  const [results, setResults] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'artists' | 'venues' | 'djs'>('artists');

  useEffect(() => {
    fetch('/api/discover')
      .then(r => r.ok ? r.json() : null)
      .then(d => setResults(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const profiles = results?.[tab] ?? [];

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '28px 36px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', margin: 0 }}>Discover</h2>
          <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginTop: 4 }}>Artists, venues, and DJs you haven't hyped yet</div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
          {(['artists', 'venues', 'djs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 13, border: 'none', cursor: 'pointer', background: tab === t ? 'var(--bg-3)' : 'transparent', color: tab === t ? 'var(--ink)' : 'var(--ink-3)', textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
            {Array(8).fill(null).map((_, i) => <div key={i} style={{ height: 200, background: 'var(--bg-2)', borderRadius: 12, animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)' }} />)}
          </div>
        ) : profiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(244,239,233,.3)', fontFamily: 'var(--f-m,monospace)', fontSize: 13 }}>
            {tab === 'artists' ? 'No new artists to discover right now' : tab === 'venues' ? 'No venues to discover yet' : 'No DJs to discover yet'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
            {profiles.map(p => <ProfileCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
