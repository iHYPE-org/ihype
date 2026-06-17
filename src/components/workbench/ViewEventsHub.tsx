'use client';

import React, { useState } from 'react';
import type { WorkbenchData } from '@/types/workbench';

function SubTabs({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 32px', marginBottom: 28, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            padding: '7px 16px', borderRadius: 99, cursor: 'pointer',
            fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13,
            border: o === value ? '1px solid rgba(255,80,41,.35)' : '1px solid var(--line-2)',
            background: o === value ? 'rgba(255,80,41,.12)' : 'transparent',
            color: o === value ? 'var(--ink)' : 'var(--ink-2)',
            transition: 'background .14s, color .14s',
          }}
        >{o}</button>
      ))}
    </div>
  );
}

// ─── Upcoming (formerly Near Me) ──────────────────────────────

function UpcomingPanel({ data }: { data: WorkbenchData }) {
  const shows = data.shows.slice(0, 6);
  const distances = ['0.4 mi', '1.1 mi', '2.3 mi', '3.0 mi', '4.5 mi', '6.2 mi'];
  const TINTS = ['#ff5029', '#22e5d4', '#b983ff', '#ffb84a', '#ff3e9a', '#5b8cff'];

  return (
    <div style={{ padding: '0 32px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(280px,1fr)', gap: 20, alignItems: 'start' }}>
        {/* Map placeholder */}
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--line-2)', minHeight: 400, background: 'radial-gradient(120% 120% at 30% 20%, #14110d, #0a0805)' }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} x1="0" y1={`${i * 12 + 6}%`} x2="100%" y2={`${i * 12 + 6}%`} stroke="rgba(255,255,255,.05)" strokeWidth="1" />)}
            {Array.from({ length: 11 }).map((_, i) => <line key={`v${i}`} x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="rgba(255,255,255,.05)" strokeWidth="1" />)}
            <path d="M0,55% L40%,52% L55%,68% L100%,60%" stroke="rgba(255,80,41,.22)" strokeWidth="3" fill="none" />
            <path d="M30%,0 L34%,40% L48%,75% L52%,100%" stroke="rgba(34,229,212,.18)" strokeWidth="3" fill="none" />
          </svg>
          {/* You-are-here */}
          <span style={{ position: 'absolute', left: '50%', top: '48%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--role-fan)', boxShadow: '0 0 0 6px rgba(185,131,255,.18)' }} />
          {/* Pins */}
          {[{ x: '28%', y: '34%', tint: TINTS[0] }, { x: '62%', y: '52%', tint: TINTS[1] }, { x: '44%', y: '70%', tint: TINTS[2] }, { x: '74%', y: '28%', tint: TINTS[3] }].map((p, i) => (
            <span key={i} style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-100%)' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: '50% 50% 50% 2px', transform: 'rotate(45deg)', background: `${p.tint}cc` }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" style={{ transform: 'rotate(-45deg)' }}>
                  <path d="M8.56 2.9A7 7 0 0 1 19 9v.5A14.83 14.83 0 0 1 12 21a14.83 14.83 0 0 1-7-11.5V9a7 7 0 0 1 2.7-5.63"/>
                </svg>
              </span>
            </span>
          ))}
          <div style={{ position: 'absolute', bottom: 14, left: 14, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--role-fan)', display: 'inline-block' }} /> Your location
          </div>
        </div>

        {/* Nearby list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shows.map((s, i) => {
            const tint = TINTS[i % TINTS.length];
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-2)',
                cursor: 'pointer',
              }}>
                <span style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg,${tint}cc,${tint}44)`, display: 'grid', placeItems: 'center' }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M2 6a1.5 1.5 0 0 0 0 3v3h20V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M14 3v10" strokeDasharray="1.5 1.5"/>
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{s.venue} · {distances[i]}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>${s.price}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--success)', marginTop: 2 }}>$0 fees</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Favorites Panel ──────────────────────────────────────────

const SAVED_VENUES = [
  { id: 'sv1', name: 'The Empty Bottle',   city: 'Chicago, IL',    tint: '#ff5029' },
  { id: 'sv2', name: 'Bowery Ballroom',    city: 'New York, NY',   tint: '#22e5d4' },
  { id: 'sv3', name: 'Troubadour',         city: 'Los Angeles, CA', tint: '#b983ff' },
  { id: 'sv4', name: 'Neumos',             city: 'Seattle, WA',    tint: '#ffb84a' },
  { id: 'sv5', name: 'Schubas Tavern',     city: 'Chicago, IL',    tint: '#ff3e9a' },
];

const SAVED_CITIES = [
  { name: 'Chicago' },
  { name: 'New York' },
  { name: 'Los Angeles' },
  { name: 'Austin' },
];

function FavoritesPanel() {
  const [venues, setVenues] = useState(SAVED_VENUES);
  const [cities, setCities] = useState(SAVED_CITIES);

  return (
    <div style={{ padding: '0 32px 32px' }}>
      {/* Saved venues */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>
          Saved venues
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {venues.map(v => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-2)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${v.tint}cc, ${v.tint}44)`,
                display: 'grid', placeItems: 'center',
              }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{v.city}</div>
              </div>
              <button
                onClick={() => setVenues(prev => prev.filter(x => x.id !== v.id))}
                style={{
                  padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 12,
                  border: '1px solid var(--line-2)', background: 'transparent',
                  color: 'var(--ink-3)',
                }}
              >Unfollow</button>
            </div>
          ))}
          {venues.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>
              No saved venues yet — follow a venue from Upcoming or Shows.
            </div>
          )}
        </div>
      </div>

      {/* Saved cities */}
      <div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>
          Saved cities
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {cities.map(c => (
            <div key={c.name} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              borderRadius: 99, border: '1px solid var(--line-2)', background: 'var(--bg-2)',
            }}>
              <span style={{ fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{c.name}</span>
              <button
                onClick={() => setCities(prev => prev.filter(x => x.name !== c.name))}
                style={{
                  display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', fontSize: 11, lineHeight: 1,
                }}
                aria-label={`Unfollow ${c.name}`}
              >×</button>
            </div>
          ))}
          {cities.length === 0 && (
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>No saved cities yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── For You Panel ────────────────────────────────────────────

function ForYouPanel({ data }: { data: WorkbenchData }) {
  const recommended = data.shows.slice(0, 4);
  const TINTS = ['#22e5d4', '#b983ff', '#ffb84a', '#ff3e9a'];
  const reasons = ['Because you hyped similar artists', 'Trending in your city', 'Matches your genre taste', 'Artist you follow'];

  return (
    <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
      {recommended.map((s, i) => {
        const tint = TINTS[i % TINTS.length];
        return (
          <div key={s.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 14, padding: '16px 18px 10px' }}>
              <span style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg,${tint}cc,${tint}44)`, display: 'grid', placeItems: 'center' }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M12 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/>
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: tint, marginBottom: 5 }}>
                  <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke={tint} strokeWidth="1.8" strokeLinecap="round"><path d="M8 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>
                  {reasons[i % reasons.length]}
                </div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', lineHeight: 1.2 }}>{s.name}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{s.date}</div>
              </div>
            </div>
            <div style={{ padding: '8px 18px 16px' }}>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--line-2)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${45 + i * 10}%`, borderRadius: 2, background: `linear-gradient(90deg,${tint},${tint}88)` }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--success)' }}>
                  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><path d="M3 8l4 4 6-6"/></svg>
                  $0 fees
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ padding: '7px 14px', borderRadius: 8, fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none', color: '#fff', background: 'linear-gradient(135deg,var(--accent),#ff3e9a)' }}>
                    ${s.price} · Get tickets
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Shows Panel ──────────────────────────────────────────────

const RADIO_SHOWS = [
  { id: 'rs1', name: 'The Halflight Hour',   host: 'Maya Reyes',    schedule: 'Fridays 9pm',    listeners: 1240, color: '#ff5029' },
  { id: 'rs2', name: 'Basement Frequencies', host: 'Colin Atwood',  schedule: 'Tuesdays 11pm',  listeners: 880,  color: '#22e5d4' },
  { id: 'rs3', name: 'Curated by Vela',      host: 'Vela',          schedule: 'Sundays 8pm',    listeners: 2100, color: '#b983ff' },
  { id: 'rs4', name: 'Local Dispatch',       host: 'DJ Trace',      schedule: 'Saturdays 10pm', listeners: 650,  color: '#ffb84a' },
  { id: 'rs5', name: 'Indigo Sessions',      host: 'Mara Solano',   schedule: 'Wednesdays 7pm', listeners: 430,  color: '#ff3e9a' },
];

function ShowsPanel() {
  return (
    <div style={{ padding: '0 32px 32px' }}>
      {/* Clarification banner */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px',
        borderRadius: 12, background: 'rgba(255,184,74,.08)', border: '1px solid rgba(255,184,74,.2)',
        marginBottom: 24,
      }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ffb84a" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
        <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          These are <strong style={{ color: 'var(--ink)' }}>radio broadcasts</strong>, not live events or ticket sales. Tune in to hear curated shows from artists and DJs.
        </div>
      </div>

      {/* Shows list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {RADIO_SHOWS.map(show => (
          <div key={show.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            borderRadius: 14,
            background: `linear-gradient(90deg, ${show.color}0e, var(--bg-2))`,
            border: `1px solid ${show.color}28`,
          }}>
            {/* Icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${show.color}cc, ${show.color}44)`,
              display: 'grid', placeItems: 'center',
            }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v1.5M12 20.5V22M2 12h1.5M20.5 12H22"/>
              </svg>
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.name}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                {show.host} · {show.schedule}
              </div>
            </div>
            {/* Listeners */}
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: show.color, flexShrink: 0, textAlign: 'right' }}>
              {show.listeners.toLocaleString()} listening
            </div>
            {/* CTA */}
            <button style={{
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
              fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13,
              border: `1px solid ${show.color}55`,
              background: `${show.color}14`,
              color: show.color,
            }}>
              Tune in
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

const SUB_TABS = ['Upcoming', 'Favorites', 'For you', 'Shows'];

const HEADERS: Record<string, [string, string]> = {
  Upcoming:  ['Near you',            'Shows around the corner.'],
  Favorites: ['Your saved spots',    'Venues and cities you follow.'],
  'For you': ['Based on your hypes', 'Picked for you.'],
  Shows:     ['Radio broadcasts',    'Shows on air, not on stage.'],
};

export function ViewEventsHub({ data }: { data: WorkbenchData }) {
  const [sub, setSub] = useState('Upcoming');
  const [kicker, title] = HEADERS[sub];

  return (
    <div>
      <div style={{ padding: '32px 32px 20px' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{kicker}</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-.04em', margin: '0 0 20px', lineHeight: 1 }}>{title}</h1>
      </div>
      <SubTabs value={sub} options={SUB_TABS} onChange={setSub} />
      {sub === 'Upcoming'  && <UpcomingPanel data={data} />}
      {sub === 'Favorites' && <FavoritesPanel />}
      {sub === 'For you'   && <ForYouPanel data={data} />}
      {sub === 'Shows'     && <ShowsPanel />}
    </div>
  );
}
