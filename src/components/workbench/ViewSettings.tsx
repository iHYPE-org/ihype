'use client';

import React from 'react';
import type { WorkbenchData, WbTrack } from '@/components/WorkbenchShell';
import { DEFAULT_PREFS } from './types';
import { IcLibrary, IcRadio, IcTicket, IcDisco, IcStudio, IcCheck, IcPlay, IcHeart } from './icons';
import { Toggle } from './Toggle';
import { Panel } from './primitives';

// ─────────────────────────────────────────────────────────────
// ViewLibrary (stub)
// ─────────────────────────────────────────────────────────────
function TrackCard({ track, active, onClick }: { track: WbTrack; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: 8, border: `1px solid ${active ? track.color : 'var(--line)'}`,
      borderRadius: 8, background: 'var(--bg-3)', textAlign: 'left',
      transition: 'border-color .2s', cursor: 'pointer', width: '100%',
    }}>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 5, marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${track.color}, ${track.color}80)` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,.25), transparent 65%)' }} />
        <div style={{ position: 'absolute', left: 10, bottom: 10, width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IcPlay s={12} />
        </div>
        <div style={{ position: 'absolute', right: 8, top: 8, padding: '2px 7px', background: 'rgba(0,0,0,.5)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a', display: 'flex', alignItems: 'center', gap: 3 }}>
          <IcHeart s={10} c="#ff3e9a" /> {track.hypeCount}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, letterSpacing: '-.005em', color: 'var(--ink)' }}>{track.title}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{track.artistName} · {track.duration}</div>
    </button>
  );
}

export function ViewLibrary({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#b983ff', marginBottom: 10 }}>● YOUR SAVED TRACKS · {data.tracks.length} SONGS · 18 PLAYLISTS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Library</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Everything you&apos;ve HYPEd, saved from Discover seeds, or curated. Your library is yours.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { n: 'HYPEd tracks', c: '#ff3e9a', count: data.tracks.length },
          { n: 'Saved from seeds', c: '#ff5029', count: Math.floor(data.tracks.length * 0.4) },
          { n: 'Writing room', c: '#b983ff', count: 42 },
          { n: 'Tour van', c: '#22e5d4', count: 88 },
        ].map(p => (
          <div key={p.n} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', cursor: 'pointer' }}>
            <div style={{ aspectRatio: '1', borderRadius: 6, background: `linear-gradient(135deg, ${p.c}, ${p.c}80)`, marginBottom: 10 }} />
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.n}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{p.count} tracks</div>
          </div>
        ))}
      </div>
      <Panel title="Recent tracks">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, padding: '14px 16px' }}>
          {data.tracks.map((t, i) => <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />)}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewDiscover (stub)
// ─────────────────────────────────────────────────────────────
export function ViewDiscover({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● DISCOVER · SEEDS · NEW ARTISTS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Discover</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Swipe through 15–30 second seeds from new artists. Right to save, left to skip, up to HYPE.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {data.tracks.map((t, i) => <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewSettings
// ─────────────────────────────────────────────────────────────
export function ViewSettings({ prefs, setPref, data, onBack }: {
  prefs: typeof DEFAULT_PREFS;
  setPref: (k: string, v: unknown) => void;
  data: WorkbenchData;
  onBack?: () => void;
}) {
  void data; // data kept for potential future use
  const ACCENTS = [
    { v: '#ff5029', label: 'Ember' }, { v: '#ff3e9a', label: 'Hot pink' },
    { v: '#b983ff', label: 'Lilac' }, { v: '#22e5d4', label: 'Aqua' },
    { v: '#ffb84a', label: 'Amber' }, { v: '#7fb3ff', label: 'Sky' },
  ];
  const PIN_TOOLS = [
    { k: 'library', label: 'Library', sub: 'HYPEd tracks, playlists', icon: <IcLibrary s={18} /> },
    { k: 'radio', label: 'Radio', sub: 'Tune in to shows', icon: <IcRadio s={18} /> },
    { k: 'tickets', label: 'Live Events', sub: 'Browse, hold, sell, scan', icon: <IcTicket s={18} /> },
    { k: 'discover', label: 'Discover', sub: 'Seeds · swipe new artists', icon: <IcDisco s={18} /> },
    { k: 'studio', label: 'Studio', sub: 'Show Creator · uploads', icon: <IcStudio s={18} /> },
  ];

  return (
    <div style={{ padding: '24px 32px 32px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--ink-3)', marginBottom: 10 }}>● PERSONAL · APPLIES TO THIS BROWSER</div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Settings <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>· page customization</span></h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 580, lineHeight: 1.5 }}>Make iHYPE feel like yours. Changes apply live.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onBack && (
            <button onClick={onBack} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.04em', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
          )}
          <button onClick={() => { if (window.confirm('Reset all settings to defaults?')) setPref('__reset__', null); }} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.04em', background: 'none', cursor: 'pointer' }}>Reset to defaults</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Accent */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Accent color</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>Used for highlights, the player, and active nav.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {ACCENTS.map(c => (
              <button key={c.v} onClick={() => setPref('accent', c.v)} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                border: `1px solid ${prefs.accent === c.v ? c.v : 'var(--line)'}`,
                borderRadius: 8, background: 'var(--bg-3)', transition: 'all .15s', textAlign: 'left', cursor: 'pointer',
                boxShadow: prefs.accent === c.v ? `0 0 0 1px ${c.v}80` : 'none',
              }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: c.v, flexShrink: 0 }} />
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink)', letterSpacing: '.04em' }}>{c.label}</div>
                {prefs.accent === c.v && <div style={{ position: 'absolute', top: 6, right: 6, color: c.v }}><IcCheck s={11} /></div>}
              </button>
            ))}
          </div>
          {/* Accent preview */}
          <div style={{
            marginTop: 14, background: 'var(--bg-3)', border: '1px solid var(--line)',
            borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 14
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: `linear-gradient(135deg, ${prefs.accent}, var(--pink))`,
              flexShrink: 0
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Preview</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: prefs.accent, letterSpacing: '.08em', marginTop: 3 }}>
                ♥ 1,247 HYPEs this week
              </div>
            </div>
            <button style={{
              padding: '7px 14px', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13,
              fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
              border: 'none', cursor: 'pointer', color: '#fff',
              background: `linear-gradient(135deg, ${prefs.accent}, var(--pink))`
            }}>HYPE</button>
          </div>
        </section>

        {/* Density */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Density</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>Tighter = more on screen. Comfortable = more breathing room.</div>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-3)', borderRadius: 7, border: '1px solid var(--line)' }}>
            {[['compact','Compact'],['cozy','Cozy'],['comfy','Comfortable']].map(([k,l]) => (
              <button key={k} onClick={() => setPref('density', k)} style={{
                flex: 1, padding: '8px 10px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 13, letterSpacing: '.04em', border: 'none', cursor: 'pointer',
                background: prefs.density === k ? 'var(--bg)' : 'transparent',
                color: prefs.density === k ? 'var(--ink)' : 'var(--ink-3)',
              }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {[
              { k: 'queueRail', l: 'Show the queue rail', s: 'Right-hand sidebar. Off frees up ~300px.' },
              { k: 'stickyDock', l: 'Sticky player dock', s: 'Always show the player at the bottom.' },
            ].map(opt => (
              <div key={opt.k} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{opt.l}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{opt.s}</div>
                </div>
                <Toggle on={(prefs as Record<string, unknown>)[opt.k] as boolean} onChange={v => setPref(opt.k, v)} />
              </div>
            ))}
          </div>
        </section>

        {/* Pinned tools — span 2 */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px', gridColumn: 'span 2' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Pinned tools</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>What shows in the left rail. Home and Settings are always present.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PIN_TOOLS.map(t => {
              const pinned = prefs.pinned.includes(t.k);
              return (
                <button key={t.k} onClick={() => setPref('togglePin', t.k)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: `1px solid ${pinned ? `${prefs.accent}50` : 'var(--line)'}`,
                  borderRadius: 8, transition: 'all .15s', cursor: 'pointer',
                  background: pinned ? `${prefs.accent}08` : 'var(--bg-3)',
                }}>
                  <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, background: 'var(--bg-2)', color: pinned ? prefs.accent : 'var(--ink-3)' }}>{t.icon}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t.label}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.02em', marginTop: 2 }}>{t.sub}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', border: `1px solid ${pinned ? `${prefs.accent}40` : 'var(--line-2)'}`, borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', color: pinned ? prefs.accent : 'var(--ink-3)' }}>
                    {pinned ? <><IcCheck s={11} /> pinned</> : 'pin'}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Home panels — span 2 */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px', gridColumn: 'span 2' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Home page panels</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>What appears on Home below the greeting.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { k: 'panel_stats', l: 'Stat row', d: 'Hype, sales, plays, payouts' },
              { k: 'panel_tonight', l: 'Tonight in Chicago', d: 'Local shows + capacity bars' },
              { k: 'panel_activity', l: 'Activity feed', d: 'Hypes, payouts, bookings' },
              { k: 'panel_hyped', l: 'Hyped this week', d: '6-up grid of trending tracks' },
              { k: 'panel_roles', l: 'Your roles', d: 'Active + add new' },
            ].map(p => (
              <label key={p.k} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                border: `1px solid ${(prefs as Record<string,unknown>)[p.k] ? `${prefs.accent}40` : 'var(--line)'}`,
                borderRadius: 8, background: 'var(--bg-3)', cursor: 'pointer',
              }}>
                <Toggle on={(prefs as Record<string,unknown>)[p.k] as boolean} onChange={v => setPref(p.k, v)} small />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{p.l}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{p.d}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* City */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>City + scene</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>Used everywhere — &ldquo;Tonight in&rdquo;, radio picks, discover defaults.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select value={prefs.city} onChange={e => setPref('city', e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink)' }}>
              {['Chicago, IL','Brooklyn, NY','Los Angeles, CA','Austin, TX','Detroit, MI','Atlanta, GA'].map(c => <option key={c}>{c}</option>)}
            </select>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>· current</span>
          </div>
        </section>

        {/* Greeting */}
        <section style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, letterSpacing: '-.005em', color: 'var(--ink)', marginBottom: 4 }}>Greeting style</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.02em', marginBottom: 14 }}>The big line at the top of Home.</div>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-3)', borderRadius: 7, border: '1px solid var(--line)' }}>
            {[['warm','Warm name'],['minimal','Minimal'],['data','Data first']].map(([k,l]) => (
              <button key={k} onClick={() => setPref('greeting', k)} style={{
                flex: 1, padding: '8px 10px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 13, letterSpacing: '.04em', border: 'none', cursor: 'pointer',
                background: prefs.greeting === k ? 'var(--bg)' : 'transparent',
                color: prefs.greeting === k ? 'var(--ink)' : 'var(--ink-3)',
              }}>{l}</button>
            ))}
          </div>
        </section>
      </div>

      <div style={{ marginTop: 20, padding: '14px 18px', border: '1px dashed var(--line-2)', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', letterSpacing: '.02em' }}>
        Preferences live in this browser. Sign in to sync across devices — keys never leave your control.
      </div>
    </div>
  );
}
