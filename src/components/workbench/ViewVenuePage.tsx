'use client';

import React, { useState } from 'react';
import { WorkbenchData } from '@/types/workbench';
import ViewPageStudio from './ViewPageStudio';

type Tab = 'insights' | 'fanpage';

const GEO_BREAKDOWN = [
  { area: 'Ukrainian Village, Chicago', followers: 380 },
  { area: 'Logan Square, Chicago', followers: 240 },
  { area: 'Wicker Park, Chicago', followers: 220 },
  { area: 'Brooklyn, NY', followers: 180 },
  { area: 'Austin, TX', followers: 140 },
];

const ARTIST_REQUESTS = [
  { name: 'Jordan Nore', genre: 'Alt-R&B', city: 'Chicago, IL', draw: 280, date: 'Jun 28', ask: '$1,200', overlap: '74%' },
  { name: 'Mau Lwin', genre: 'Bedroom Pop', city: 'Chicago, IL', draw: 180, date: 'Jul 12', ask: '$800', overlap: '68%' },
  { name: 'The Veldt Kids', genre: 'Post-Punk', city: 'Milwaukee, WI', draw: 220, date: 'Jul 26', ask: '$1,100', overlap: '61%' },
  { name: 'Night Transit', genre: 'Shoegaze', city: 'Indianapolis, IN', draw: 150, date: 'Aug 9', ask: '$700', overlap: '48%' },
];

const ACTIVITY = [
  { text: 'Jordan Nore sent a booking request', time: '1h ago' },
  { text: '38 new followers from Brooklyn this week', time: '6h ago' },
  { text: 'Your HYPE count crossed 600 this month', time: '1d ago' },
  { text: "Mau Lwin's fans are listening in your area", time: '2d ago' },
  { text: 'Page view spike: +240% on Saturday', time: '3d ago' },
];

export function ViewVenuePage({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<Tab>('insights');

  const maxFollowers = Math.max(...GEO_BREAKDOWN.map(g => g.followers));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 24px', borderBottom: '1px solid var(--line-2)', background: 'var(--bg-2)',
      }}>
        {(['insights', 'fanpage'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
              fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em',
              background: tab === t ? 'rgba(255,80,41,.1)' : 'transparent',
              border: tab === t ? '1px solid rgba(255,80,41,.22)' : '1px solid transparent',
              color: 'var(--ink)',
              minHeight: 32,
              transition: 'all .15s',
            }}
          >
            {t === 'insights' ? 'Insights' : 'Fan Page'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'insights' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>

            {/* Section 1: Header */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontFamily: 'var(--f-d)', fontSize: 26, fontWeight: 800, color: 'var(--ink)', margin: 0, lineHeight: 1.1 }}>
                Venue Dashboard
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--f-b)', fontSize: 15, color: 'var(--ink-2)' }}>{data.userName}</span>
                <span style={{
                  fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                  padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase',
                  background: 'rgba(34,229,212,.1)', border: '1px solid rgba(34,229,212,.25)', color: '#22e5d4',
                }}>Venue</span>
              </div>
            </div>

            {/* Section 2: Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 36 }}>
              <MetricCard
                label="HYPE Count"
                value={(data.lifeStats?.totalHype ?? 640).toLocaleString()}
                delta="+22% this month"
                color="#ff5029"
              />
              <MetricCard label="Followers" value="1,840" delta="+140 this month" color="#ff3e9a" />
              <MetricCard label="Monthly Page Views" value="12,400" delta="+31% vs last month" color="#b983ff" />
              <MetricCard
                label="Booking Requests"
                value={(data.pendingVenueRequestCount ?? 3).toString()}
                delta="3 pending"
                color="#22e5d4"
              />
            </div>

            {/* Section 3: Geo Breakdown */}
            <SectionTitle title="Geo Breakdown" subtitle="Where your followers are coming from" />
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '18px 20px', marginBottom: 36 }}>
              {GEO_BREAKDOWN.map(g => (
                <div key={g.area} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{ width: 200, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', flexShrink: 0 }}>{g.area}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--line-2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${(g.followers / maxFollowers) * 100}%`,
                      background: 'linear-gradient(90deg, #22e5d4, #b983ff)',
                    }} />
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', width: 50, textAlign: 'right' }}>{g.followers.toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Section 4: Artist Play Requests */}
            <SectionTitle title="Artist Play Requests" subtitle="Artists who want to play your room" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 36 }}>
              {ARTIST_REQUESTS.map(r => (
                <div key={r.name} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{r.name}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{r.genre} · {r.city}</div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, color: '#ff3e9a',
                      background: 'rgba(255,62,154,.1)', border: '1px solid rgba(255,62,154,.25)',
                      padding: '3px 8px', borderRadius: 99,
                    }}>{r.overlap} overlap</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '.08em' }}>EST. DRAW</div>
                      <div style={{ fontFamily: 'var(--f-d)', fontSize: 16, fontWeight: 700, color: '#ffb84a' }}>{r.draw}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '.08em' }}>DATE</div>
                      <div style={{ fontFamily: 'var(--f-d)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{r.date}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '.08em' }}>ASK</div>
                      <div style={{ fontFamily: 'var(--f-d)', fontSize: 16, fontWeight: 700, color: '#22e5d4' }}>{r.ask}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={outlineBtnStyle}>View request</button>
                    <button style={tealBtnStyle}>Book them</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Section 5: Recent Activity */}
            <SectionTitle title="Recent Activity" subtitle="" />
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
                  borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--line-2)' : 'none',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22e5d4', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)' }}>{a.text}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>{a.time}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ViewPageStudio />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: subtitle ? 4 : 0 }}>{title}</div>
      {subtitle && <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-3)' }}>{subtitle}</div>}
    </div>
  );
}

function MetricCard({ label, value, delta, color }: { label: string; value: string; delta: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 28, fontWeight: 800, color, lineHeight: 1, marginBottom: 8 }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#22e5d4' }}>{delta}</div>
    </div>
  );
}

const outlineBtnStyle: React.CSSProperties = {
  flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
  background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ink-2)',
  minHeight: 36,
};

const tealBtnStyle: React.CSSProperties = {
  flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
  background: 'rgba(34,229,212,.12)', border: '1px solid rgba(34,229,212,.3)', color: '#22e5d4',
  minHeight: 36,
};
