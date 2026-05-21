'use client';

import React, { useState, memo } from 'react';
import { type WorkbenchData, type WbStat } from '@/components/WorkbenchShell';

// ── View: Venue dashboard ──────────────────────────────────────
export const ViewVenue = memo(function ViewVenue({ data }: { data: WorkbenchData }) {
  const [tab, setTab] = useState<'overview' | 'shows' | 'scan'>('overview');
  const totalSold = data.shows.reduce((a, s) => a + s.sold, 0);
  const totalGross = data.shows.reduce((a, s) => a + s.sold * s.price, 0);
  const venueStats: WbStat[] = [
    { label: 'SHOWS HOSTED', value: String(data.shows.length), delta: 'this season', color: '#22e5d4' },
    { label: 'TICKETS SOLD', value: String(totalSold), delta: 'across all shows', color: '#22e5d4' },
    { label: 'GROSS REVENUE', value: `$${totalGross.toLocaleString()}`, delta: 'at face value', color: '#ffb84a' },
    { label: 'PLATFORM FEE', value: '0%', delta: 'always', color: '#b983ff' },
  ];
  return (
    <div className="wb-view-pad">
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● VENUE DASHBOARD · {data.city.toUpperCase()}</div>
          <h1 className="wb-page-title">Venue</h1>
          <p className="wb-page-sub">Manage your shows, verify tickets at the door, and settle payouts — all without leaving iHYPE.</p>
        </div>
        <div className="wb-tabs">
          {(['overview', 'shows', 'scan'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)} className={`wb-tab${tab === k ? ' wb-tab-active' : ''}`}>
              {k === 'overview' ? 'Overview' : k === 'shows' ? 'Shows' : 'Scan'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'overview' && (
        <>
          <div className="wb-stat-row">
            {venueStats.map(s => (
              <div key={s.label} className="wb-stat-card">
                <div className="wb-stat-l">{s.label}</div>
                <div className="wb-stat-v">{s.value}</div>
                <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
              </div>
            ))}
          </div>
          <div className="wb-panel">
            <div className="wb-panel-head">
              <div className="wb-panel-title">Upcoming shows</div>
              <button className="wb-link-btn" onClick={() => setTab('shows')}>All shows →</button>
            </div>
            {data.shows.filter(s => s.status !== 'NEAR SOLD' || true).slice(0, 5).map(s => (
              <div key={s.id} className="wb-show-row">
                <div className="wb-show-stripe" style={{ background: s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : 'var(--wb-ink-3)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{s.name}</div>
                  <div className="wb-show-meta">{s.date} · {s.time}</div>
                </div>
                <div className="wb-cap">
                  <div className="wb-cap-bar"><div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} /></div>
                  <div className="wb-cap-txt">{s.sold}/{s.capacity}</div>
                </div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--wb-ink)', minWidth: 60, textAlign: 'right' }}>${(s.sold * s.price).toLocaleString()}</div>
              </div>
            ))}
            {data.shows.length === 0 && (
              <div className="wb-empty">No shows yet — create your first event.</div>
            )}
          </div>
        </>
      )}
      {tab === 'shows' && (
        <div className="wb-panel">
          <div className="wb-panel-head">
            <div className="wb-panel-title">All shows</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{data.shows.length} total</div>
          </div>
          {data.shows.map(s => (
            <div key={s.id} className="wb-ticket-row">
              <div className="wb-show-stripe" style={{ background: '#22e5d4' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wb-show-name">{s.name}</div>
                <div className="wb-show-meta">{s.date} · {s.time}</div>
              </div>
              <div className="wb-ticket-col"><div className="wb-fact-l">SOLD</div><div className="wb-fact-v">{s.sold}/{s.capacity}</div></div>
              <div className="wb-ticket-col"><div className="wb-fact-l">GROSS</div><div className="wb-fact-v">${(s.sold * s.price).toLocaleString()}</div></div>
              <div className="wb-status-pill" style={{ color: s.status === 'TONIGHT' ? '#22e5d4' : '#ffb84a', borderColor: s.status === 'TONIGHT' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)' }}>{s.status}</div>
            </div>
          ))}
          {data.shows.length === 0 && <div className="wb-empty">No shows yet.</div>}
        </div>
      )}
      {tab === 'scan' && (
        <div className="wb-scan-card">
          <div>
            <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● VENUE MODE · DOOR SCANNER</div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '8px 0' }}>Door scanner</h2>
            <p className="wb-page-sub">Point a phone camera at the QR. Valid tickets show green; replays are blocked at the protocol layer.</p>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { code: 'iH-MR18-K3X9', meta: 'GA · admitted 21:04', valid: true },
                { code: 'iH-MR18-7QQR', meta: 'Transferred 14m ago · GA · admitted 21:06', valid: true },
                { code: 'iH-MR18-9BLN', meta: 'Already scanned at 20:51 · blocked', valid: false },
              ].map((r, i) => (
                <div key={i} className="wb-scan-row" style={{ borderLeft: `2px solid ${r.valid ? '#22e5d4' : '#ff5029'}` }}>
                  <span aria-label={r.valid ? 'Valid' : 'Invalid'} style={{ color: r.valid ? '#22e5d4' : '#ff5029', fontWeight: 700 }}>{r.valid ? '✓' : '✗'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink)' }}>{r.code}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{r.meta}</div>
                  </div>
                  <div style={{ color: r.valid ? '#22e5d4' : '#ff5029', fontFamily: 'var(--f-m)', fontSize: 11 }}>{r.valid ? 'VALID' : 'REPLAY'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="wb-scan-viewport">
            <div className="wb-scan-laser" />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', letterSpacing: '.1em' }}>Ready for QR…</div>
          </div>
        </div>
      )}
    </div>
  );
});
