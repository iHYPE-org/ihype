'use client';

import React, { memo, useState, useEffect } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { IcBolt, IcDot, IcHeart } from './icons';
import { Panel } from './primitives';

// ── Schedule heatmap ─────────────────────────────────────────────────────────
const SCHEDULE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SCHEDULE_SLOTS = ['6A', '9A', '12P', '3P', '6P', '9P', '12A', '3A'];

function heatFor(d: number, s: number): number {
  const v = ((d * 7 + s * 3) * 2654435761) >>> 0;
  return (v % 100) < 20 ? 0 : (v % 100) < 50 ? 1 : (v % 100) < 75 ? 2 : 3;
}

function ScheduleHeatmap({ selected, onToggle }: { selected: Set<string>; onToggle: (key: string) => void }) {
  const heatColors = ['transparent', 'rgba(34,229,212,.12)', 'rgba(34,229,212,.35)', 'rgba(34,229,212,.65)'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `48px repeat(${SCHEDULE_DAYS.length}, 1fr)`, gap: 3, marginBottom: 6 }}>
        <div />
        {SCHEDULE_DAYS.map(d => (
          <div key={d} style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', letterSpacing: '.08em' }}>{d}</div>
        ))}
      </div>
      {SCHEDULE_SLOTS.map((slot, si) => (
        <div key={slot} style={{ display: 'grid', gridTemplateColumns: `48px repeat(${SCHEDULE_DAYS.length}, 1fr)`, gap: 3, marginBottom: 3 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', letterSpacing: '.06em' }}>{slot}</div>
          {SCHEDULE_DAYS.map((_, di) => {
            const key = `${di}-${si}`;
            const on = selected.has(key);
            return (
              <button key={key} onClick={() => onToggle(key)} style={{
                height: 18, borderRadius: 3, border: 'none', cursor: 'pointer',
                background: on ? '#22e5d4' : heatColors[heatFor(di, si)],
                transition: 'background .1s',
              }} />
            );
          })}
        </div>
      ))}
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>Click slots to schedule this show&apos;s broadcast window</div>
    </div>
  );
}

// ── Creator leaderboard ───────────────────────────────────────────────────────
const CREATOR_BOARD = [
  { rank: 1, name: 'Nikki K.',     plays: 8420 },
  { rank: 2, name: 'DJ Halflight', plays: 7180 },
  { rank: 3, name: 'Cobalt Vela',  plays: 5960 },
  { rank: 4, name: 'Sade R.',      plays: 4310 },
];

function CreatorLeaderboard() {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>TOP CREATORS · WEEKLY</div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {CREATOR_BOARD.map((r, i) => (
          <div key={r.rank} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: i < CREATOR_BOARD.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, color: r.rank <= 3 ? '#ffb84a' : 'var(--ink-3)', letterSpacing: '.1em' }}>{String(r.rank).padStart(2, '0')}</span>
            <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{r.name}</span>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)' }}>{r.plays.toLocaleString()} plays</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Revenue split bar ────────────────────────────────────────────────────────
function RevenueSplitBar({ artistPct = 45, youPct = 45, referrerPct = 10 }: { artistPct?: number; youPct?: number; referrerPct?: number }) {
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
        <div style={{ flex: artistPct, background: '#22e5d4' }} />
        <div style={{ flex: youPct, background: '#ff3e9a' }} />
        <div style={{ flex: referrerPct, background: '#ffb84a' }} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {[{ label: 'ARTISTS', pct: artistPct, color: '#22e5d4' }, { label: 'YOU', pct: youPct, color: '#ff3e9a' }, { label: 'REFERRERS', pct: referrerPct, color: '#ffb84a' }].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.08em' }}>{s.pct}% {s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const ViewRadio = memo(function ViewRadio({ data, onPickTrack }: {
  data: WorkbenchData; onPickTrack: (i: number) => void;
}) {
  const shows = data.radioShows;
  const [activeId, setActiveId] = useState(shows[0]?.id ?? '');
  const [hyped, setHyped] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [followingHost, setFollowingHost] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'setlist' | 'schedule' | 'splits'>('setlist');
  const [scheduleSlots, setScheduleSlots] = useState<Set<string>>(new Set());

  const show = shows.find(r => r.id === activeId) ?? shows[0];
  const FREQS = ['88.3','94.1','101.7','107.9','104.5','99.5'];
  const showIdx = shows.findIndex(r => r.id === activeId);

  useEffect(() => {
    if (!show?.hostProfileId) return;
    setFollowingHost(false);
    void fetch(`/api/follow?profileId=${show.hostProfileId}`)
      .then(r => r.json())
      .then((d: { following?: boolean }) => { if (d.following !== undefined) setFollowingHost(d.following); })
      .catch(() => null);
  }, [show?.hostProfileId]);

  async function toggleFollowHost() {
    if (!show?.hostProfileId || followBusy) return;
    setFollowBusy(true);
    const prev = followingHost;
    setFollowingHost(!followingHost);
    try {
      const res = await fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: show.hostProfileId }) });
      if (!res.ok) setFollowingHost(prev);
      else { const d = (await res.json()) as { following: boolean }; setFollowingHost(d.following); }
    } catch { setFollowingHost(prev); } finally { setFollowBusy(false); }
  }

  async function createRadioShow() {
    if (!title.trim()) return;
    setCreating(true); setCreateErr('');
    try {
      const res = await fetch('/api/shows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), description: desc.trim() || null, isRadioShow: true }) });
      if (res.ok) { setShowForm(false); setTitle(''); setDesc(''); window.location.reload(); }
      else { const d = (await res.json()) as { error?: string }; setCreateErr(d.error ?? 'Failed to create show'); }
    } finally { setCreating(false); }
  }

  if (!show) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#ff3e9a', marginBottom: 10 }}>● RADIO · iHYPE NETWORK</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Radio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 16 }}>No radio shows yet.</p>
        {showForm ? (
          <div style={{ marginTop: 20, padding: '18px 20px', border: '1px solid var(--line-2)', borderRadius: 12, background: 'var(--bg-2)', maxWidth: 480 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 14 }}>New Radio Show</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Show title *" style={{ padding: '9px 12px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 8, color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, outline: 'none' }} />
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={3} style={{ padding: '9px 12px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 8, color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, resize: 'vertical', outline: 'none' }} />
              {createErr && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff5029' }}>{createErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void createRadioShow()} disabled={creating || !title.trim()} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: creating ? 'wait' : 'pointer', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, background: 'rgba(255,62,154,.15)', color: '#ff3e9a' }}>{creating ? 'Creating…' : 'Create show'}</button>
                <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--line-2)', background: 'none', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ marginTop: 20, padding: '10px 20px', border: '1px solid rgba(255,62,154,.3)', borderRadius: 8, background: 'rgba(255,62,154,.08)', color: '#ff3e9a', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IcBolt s={12} /> Start a radio show
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#ff3e9a', marginBottom: 10 }}>
            ● ON AIR · {shows.length} CHANNELS · {shows.reduce((a, s) => a + s.listeners, 0).toLocaleString()} LISTENING NOW
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Radio</h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Curated shows from DJs and artists. No ads, no algorithm — just real people picking music.</p>
        </div>
        {showForm ? (
          <div style={{ padding: '14px 16px', border: '1px solid var(--line-2)', borderRadius: 12, background: 'var(--bg-2)', minWidth: 300 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>New Radio Show</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Show title *" style={{ padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, outline: 'none' }} />
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2} style={{ padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, resize: 'none', outline: 'none' }} />
              {createErr && <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029' }}>{createErr}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => void createRadioShow()} disabled={creating || !title.trim()} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: creating ? 'wait' : 'pointer', fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, background: 'rgba(255,62,154,.15)', color: '#ff3e9a' }}>{creating ? 'Creating…' : 'Create'}</button>
                <button onClick={() => setShowForm(false)} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--line-2)', background: 'none', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ padding: '9px 16px', border: '1px solid var(--accent-2)', color: 'var(--accent-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, background: 'none', cursor: 'pointer' }}>
            <IcBolt s={12} /> Start your show →
          </button>
        )}
      </div>

      {/* 3-col: shows list | detail+tabs | leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 220px', gap: 16 }}>
        {/* Shows list */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700 }}>
            YOUR SHOWS · {shows.length} TOTAL
          </div>
          {shows.map(r => (
            <button key={r.id} onClick={() => setActiveId(r.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderBottom: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer',
              background: r.id === activeId ? `${r.color}14` : 'transparent',
              borderLeft: `3px solid ${r.id === activeId ? r.color : 'transparent'}`,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, background: `linear-gradient(135deg, ${r.color}cc, ${r.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14 }}>📻</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                  {r.live && <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#ff3e9a', letterSpacing: '.12em', flexShrink: 0 }}>●</span>}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{r.host} · {r.listeners} listening</div>
              </div>
            </button>
          ))}
          <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: '1px dashed var(--line)', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
            + NEW SHOW
          </button>
        </div>

        {/* Detail + tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hero */}
          <div style={{ padding: '22px 26px', border: '1px solid var(--line)', borderRadius: 10, background: `linear-gradient(135deg, ${show.color}28 0%, transparent 60%), var(--bg-2)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              {show.live ? (
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid rgba(255,62,154,.3)', borderRadius: 99 }}>
                  <IcDot c="#ff3e9a" s={8} /> ON AIR · {show.listeners} listening
                </span>
              ) : (
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', padding: '4px 0' }}>
                  NEXT BROADCAST · {show.next ?? 'Unscheduled'}
                </span>
              )}
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--ink-2)' }}>{FREQS[showIdx] ?? '88.3'} MHz</span>
            </div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>{show.name}</h2>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.06em', marginTop: 8 }}>Hosted by <strong>{show.host}</strong> · {show.time}</div>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 12, maxWidth: 540, lineHeight: 1.55 }}>{show.desc}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={() => onPickTrack(0)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', background: 'linear-gradient(135deg, var(--accent), #ff3e9a)' }}>▶ Tune in</button>
              <button onClick={() => setSubscribed(s => !s)} style={{ padding: '8px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, color: subscribed ? '#22e5d4' : 'var(--ink)', background: 'none', cursor: 'pointer' }}>
                {subscribed ? '✓ Subscribed' : '＋ Subscribe'}
              </button>
              {show.hostProfileId && (
                <button onClick={() => void toggleFollowHost()} disabled={followBusy} style={{ padding: '8px 14px', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, cursor: followBusy ? 'default' : 'pointer', border: followingHost ? '1px solid rgba(34,229,212,.4)' : '1px solid var(--line-2)', background: followingHost ? 'rgba(34,229,212,.08)' : 'none', color: followingHost ? '#22e5d4' : 'var(--ink)' }}>
                  {followingHost ? '✓ Following DJ' : '+ Follow DJ'}
                </button>
              )}
              <button
                onClick={async () => {
                  setHyped(true);
                  try { await fetch('/api/hype', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'show', targetId: show.id }) }); }
                  catch { setHyped(false); }
                }}
                style={{ padding: '8px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6, color: hyped ? '#ff3e9a' : 'var(--ink)', background: 'none', cursor: 'pointer' }}
              ><IcHeart s={12} c={hyped ? '#ff3e9a' : 'currentColor'} /> {hyped ? 'Hyped!' : 'Hype show'}</button>
            </div>
          </div>

          {/* Tabs: Setlist | Schedule | Splits */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
              {(['setlist', 'schedule', 'splits'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 12,
                  fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                  background: activeTab === tab ? 'rgba(34,229,212,.08)' : 'transparent',
                  color: activeTab === tab ? '#22e5d4' : 'var(--ink-3)',
                  borderBottom: activeTab === tab ? '2px solid #22e5d4' : '2px solid transparent',
                }}>
                  {tab === 'setlist' ? 'Set List' : tab === 'schedule' ? 'Schedule' : 'Revenue'}
                </button>
              ))}
            </div>

            {activeTab === 'setlist' && (
              <Panel title="Set list · this broadcast" link="Save all to playlist →">
                <div style={{ padding: '4px 0' }}>
                  {data.tracks.slice(0, 6).map((t, i) => (
                    <button key={t.id} onClick={() => onPickTrack(i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderBottom: i < 5 ? '1px solid var(--line)' : 'none', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', width: 20 }}>{String(i + 1).padStart(2, '0')}</div>
                      <div style={{ width: 34, height: 34, borderRadius: 4, flexShrink: 0, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 2 }}>{t.artistName} · {t.album}</div>
                      </div>
                      <div style={{ padding: '2px 8px', background: 'var(--bg-3)', borderRadius: 3, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.08em' }}>
                        {i === 0 && show.live ? 'NOW' : i < 2 ? 'JUST PLAYED' : `-${i * 4}m`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 13, color: '#ff3e9a', width: 50, justifyContent: 'flex-end' }}>
                        <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
                      </div>
                    </button>
                  ))}
                  {data.tracks.length === 0 && (
                    <div style={{ padding: '20px 18px', fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>No tracks in this show yet.</div>
                  )}
                </div>
              </Panel>
            )}

            {activeTab === 'schedule' && (
              <div style={{ padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>WHEN IT AIRS · SELECT SLOTS</div>
                <ScheduleHeatmap selected={scheduleSlots} onToggle={key => setScheduleSlots(prev => {
                  const next = new Set(prev);
                  next.has(key) ? next.delete(key) : next.add(key);
                  return next;
                })} />
                {scheduleSlots.size > 0 && (
                  <button style={{ marginTop: 14, padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, background: 'rgba(34,229,212,.15)', color: '#22e5d4' }}>
                    Save schedule ({scheduleSlots.size} slots)
                  </button>
                )}
              </div>
            )}

            {activeTab === 'splits' && (
              <div style={{ padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>REVENUE SPLIT</div>
                <RevenueSplitBar />
                <div style={{ marginTop: 16, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Every play of this show splits revenue automatically. Artists get paid per spin, you earn a curation fee, and anyone who referred a listener gets a share.
                </div>
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(34,229,212,.06)', border: '1px solid rgba(34,229,212,.2)', borderRadius: 8 }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#22e5d4', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>0% PLATFORM FEE</div>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 12, color: 'var(--ink-2)' }}>iHYPE takes nothing. 100% goes to artists, creators, and the community.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div>
          <CreatorLeaderboard />
        </div>
      </div>
    </div>
  );
});
