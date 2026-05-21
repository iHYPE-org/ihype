'use client';

import React, { useState, useEffect } from 'react';
import { type WorkbenchData } from '@/components/WorkbenchShell';

// ── Types ──────────────────────────────────────────────────────
type DiscoverProfile = {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  stateRegion?: string | null;
  hypeCount: number;
  genres: string[];
  avatarImage?: string | null;
};

type DiscoverData = {
  artists: DiscoverProfile[];
  venues: DiscoverProfile[];
  djs: DiscoverProfile[];
};

const PROFILE_COLORS = ['#ff3e9a', '#b983ff', '#22e5d4', '#ff5029', '#7fb3ff', '#ffb84a'];

export function profileColor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % PROFILE_COLORS.length;
  return PROFILE_COLORS[n];
}

// ── View: Discover ─────────────────────────────────────────────
export function ViewDiscover({ data: _data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'artists'|'venues'|'djs'>('artists');
  const [discoverData, setDiscoverData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/discover')
      .then(r => r.json())
      .then((res: DiscoverData) => { setDiscoverData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const artists = discoverData?.artists ?? [];
  const venues = discoverData?.venues ?? [];
  const djs = discoverData?.djs ?? [];

  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: 'var(--wb-accent)' }}>● PERSONALIZED · BASED ON YOUR HYPES + LOCATION</div>
          <h1 className="wb-page-title">Discover</h1>
          <p className="wb-page-sub">Artists, venues, and DJs curated from your listen history, hypes, and scene.</p>
        </div>
      </div>
      <div className="wb-tabs" style={{ marginBottom: 20 }}>
        {(['artists','venues','djs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`wb-tab${tab===t?' wb-tab-active':''}`} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      {loading && (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)', padding: '20px 0' }}>Loading recommendations…</div>
      )}

      {!loading && tab === 'artists' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {artists.length === 0 && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)' }}>No artist recommendations yet.</div>}
          {artists.map(a => {
            const c = profileColor(a.id);
            const location = [a.city, a.stateRegion].filter(Boolean).join(', ');
            return (
              <div key={a.id} className="wb-panel" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${c}, ${c}80)`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{a.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>
                      {a.genres.slice(0, 2).join(' / ') || 'Music'}{location ? ` · ${location}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: '#ff3e9a' }}>{a.hypeCount.toLocaleString()} <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 400, color: 'var(--wb-ink-3)' }}>hype</span></span>
                  <button className="wb-btn-prime" style={{ padding: '6px 14px', fontSize: 11 }}>＋ Follow</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'venues' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {venues.length === 0 && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)' }}>No venue recommendations yet.</div>}
          {venues.map(v => {
            const c = profileColor(v.id);
            const location = [v.city, v.stateRegion].filter(Boolean).join(', ');
            return (
              <div key={v.id} className="wb-show-row" style={{ background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line)', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ width: 8, height: 40, borderRadius: 3, flexShrink: 0, background: c }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{v.name}{location ? <span className="wb-show-venue"> · {location}</span> : null}</div>
                  <div className="wb-show-meta">{v.genres.slice(0, 2).join(' / ') || 'Venue'}</div>
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{v.hypeCount.toLocaleString()} hypes</div>
                <button className="wb-btn-ghost" style={{ fontSize: 11 }}>View →</button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'djs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {djs.length === 0 && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-3)' }}>No DJ recommendations yet.</div>}
          {djs.map(d => {
            const c = profileColor(d.id);
            const location = [d.city, d.stateRegion].filter(Boolean).join(', ');
            return (
              <div key={d.id} className="wb-panel" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: `linear-gradient(135deg, ${c}, ${c}80)`, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--wb-ink)' }}>{d.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{location || d.genres.slice(0, 1).join('')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)' }}>{d.hypeCount.toLocaleString()} hypes</span>
                  <button className="wb-btn-prime" style={{ padding: '6px 14px', fontSize: 11 }}>Tune in</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
