'use client';

import React, { useState } from 'react';
import { WorkbenchData } from '@/types/workbench';
import ViewPageStudio from './ViewPageStudio';

type Tab = 'insights' | 'fanpage';

const HEATMAP_CITIES = [
  { city: 'Chicago, IL', listeners: 840, hype: 1240 },
  { city: 'Brooklyn, NY', listeners: 620, hype: 890 },
  { city: 'Los Angeles, CA', listeners: 410, hype: 610 },
  { city: 'Austin, TX', listeners: 280, hype: 400 },
  { city: 'Nashville, TN', listeners: 190, hype: 270 },
];

const PLAY_REQUESTS = [
  { venue: 'Empty Bottle', location: 'Chicago, IL', capacity: 400, fit: 94, offer: '$1,100', date: 'Jun 18' },
  { venue: 'Sleeping Village', location: 'Chicago, IL', capacity: 300, fit: 91, offer: '$900', date: 'Jul 5' },
  { venue: 'The Basement', location: 'Nashville, TN', capacity: 150, fit: 87, offer: '$750', date: 'Jul 20' },
  { venue: 'Cactus Club', location: 'Milwaukee, WI', capacity: 300, fit: 85, offer: '$950', date: 'Aug 3' },
];

const ACTIVITY = [
  { text: 'Mau Lwin hyped your track Velvet Hours', time: '2h ago' },
  { text: 'Empty Bottle sent you a booking request', time: '4h ago' },
  { text: '42 new listeners from Brooklyn this week', time: '1d ago' },
  { text: 'Your track Carmine crossed 400 hypes', time: '2d ago' },
  { text: 'HYPE streak: 7 days 🔥', time: '3d ago' },
];

export function ViewArtistPage({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<Tab>('insights');

  const maxListeners = Math.max(...HEATMAP_CITIES.map(c => c.listeners));

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--f-d)', fontSize: 26, fontWeight: 800, color: 'var(--ink)', margin: 0, lineHeight: 1.1 }}>
                  Artist Dashboard
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <span style={{ fontFamily: 'var(--f-b)', fontSize: 15, color: 'var(--ink-2)' }}>{data.userName}</span>
                  <span style={{
                    fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                    padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase',
                    background: 'rgba(255,80,41,.1)', border: '1px solid rgba(255,80,41,.25)', color: '#ff5029',
                  }}>Artist</span>
                </div>
              </div>
            </div>

            {/* Section 2: Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 36 }}>
              <MetricCard
                label="HYPE Given"
                value={(data.lifeStats?.totalHype ?? 1284).toLocaleString()}
                delta="+18% this week"
                color="#ff5029"
              />
              <MetricCard label="HYPE Received" value="842" delta="+12% this week" color="#ff3e9a" />
              <MetricCard label="Monthly Listeners" value="3,240" delta="+8% this month" color="#b983ff" />
              <MetricCard
                label="Shows Attended"
                value={(data.lifeStats?.eventsAttended ?? 23).toString()}
                delta="+2 this month"
                color="#22e5d4"
              />
            </div>

            {/* Section 3: Listener Heatmap */}
            <SectionTitle title="Listener Heatmap" subtitle="Where your fans are tuning in from" />
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '18px 20px', marginBottom: 36 }}>
              {HEATMAP_CITIES.map(c => (
                <div key={c.city} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{ width: 150, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', flexShrink: 0 }}>{c.city}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--line-2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${(c.listeners / maxListeners) * 100}%`,
                      background: 'linear-gradient(90deg, #ff5029, #ff3e9a)',
                    }} />
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', width: 50, textAlign: 'right' }}>{c.listeners.toLocaleString()}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029', width: 60, textAlign: 'right' }}>{c.hype.toLocaleString()} hype</div>
                </div>
              ))}
            </div>

            {/* Section 4: Play Requests */}
            <SectionTitle title="Play Requests" subtitle="Venues that want to book you" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 36 }}>
              {PLAY_REQUESTS.map(r => (
                <div key={r.venue} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{r.venue}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{r.location} · {r.capacity} cap</div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, color: '#22e5d4',
                      background: 'rgba(34,229,212,.1)', border: '1px solid rgba(34,229,212,.25)',
                      padding: '3px 8px', borderRadius: 99,
                    }}>{r.fit}% fit</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '.08em' }}>OFFER</div>
                      <div style={{ fontFamily: 'var(--f-d)', fontSize: 16, fontWeight: 700, color: '#ffb84a' }}>{r.offer}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 2, letterSpacing: '.08em' }}>DATE</div>
                      <div style={{ fontFamily: 'var(--f-d)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{r.date}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={outlineBtnStyle}>View details</button>
                    <button style={accentSmBtnStyle}>Accept booking</button>
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
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5029', flexShrink: 0 }} />
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

const accentSmBtnStyle: React.CSSProperties = {
  flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
  background: '#ff5029', border: 'none', color: '#fff',
  minHeight: 36,
};
