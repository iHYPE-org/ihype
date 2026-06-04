'use client';

import React, { useState } from 'react';
import { WorkbenchData } from '@/types/workbench';

type TourMode = 'artist' | 'venue';

interface TourStop {
  city: string;
  dist: string;
  score: number;
  reach: string;
  venues: { n: string; cap: number; fit: number }[];
}

interface ArtistResult {
  name: string;
  genre: string;
  city: string;
  score: number;
  hype: number;
  overlap: string;
  ask: string;
  draw: number;
}

const ARTIST_STOPS: TourStop[] = [
  { city: 'Chicago, IL', dist: '—', score: 94, reach: '8,400', venues: [{ n: 'Empty Bottle', cap: 400, fit: 96 }, { n: 'Sleeping Village', cap: 300, fit: 91 }, { n: 'Schubas', cap: 200, fit: 88 }] },
  { city: 'Detroit, MI', dist: '280mi', score: 87, reach: '5,200', venues: [{ n: 'Shelter', cap: 600, fit: 88 }, { n: "PJ's Lager House", cap: 200, fit: 84 }, { n: 'El Club', cap: 300, fit: 82 }] },
  { city: 'Columbus, OH', dist: '360mi', score: 82, reach: '4,100', venues: [{ n: 'Ace of Cups', cap: 200, fit: 91 }, { n: 'A&R Music Bar', cap: 500, fit: 78 }, { n: 'Basement', cap: 150, fit: 86 }] },
  { city: 'Indianapolis, IN', dist: '180mi', score: 79, reach: '3,800', venues: [{ n: 'Hi-Fi', cap: 300, fit: 83 }, { n: 'Hoosier Dome', cap: 200, fit: 77 }, { n: 'HI-FI Annex', cap: 120, fit: 80 }] },
  { city: 'Milwaukee, WI', dist: '90mi', score: 76, reach: '3,200', venues: [{ n: 'Cactus Club', cap: 300, fit: 89 }, { n: 'X-Ray Arcade', cap: 150, fit: 85 }, { n: 'Riverwest Public House', cap: 100, fit: 80 }] },
  { city: 'Nashville, TN', dist: '480mi', score: 73, reach: '6,100', venues: [{ n: 'The Basement', cap: 150, fit: 90 }, { n: 'DRKMTTR', cap: 200, fit: 86 }, { n: 'The Cobra', cap: 100, fit: 84 }] },
  { city: 'Minneapolis, MN', dist: '410mi', score: 71, reach: '4,400', venues: [{ n: '7th Street Entry', cap: 250, fit: 88 }, { n: 'Turf Club', cap: 300, fit: 82 }, { n: "Palmer's Bar", cap: 120, fit: 79 }] },
];

const VENUE_ARTISTS: ArtistResult[] = [
  { name: 'Jordan Nore', genre: 'Alt-R&B', city: 'Chicago, IL', score: 96, hype: 2140, overlap: '74%', ask: '$1,200 + door', draw: 280 },
  { name: 'Mau Lwin', genre: 'Bedroom Pop', city: 'Chicago, IL', score: 91, hype: 1840, overlap: '68%', ask: '$800 + door', draw: 180 },
  { name: 'The Veldt Kids', genre: 'Post-Punk', city: 'Milwaukee, WI', score: 87, hype: 2600, overlap: '61%', ask: '$1,100 + door', draw: 220 },
  { name: 'Sasha Quill', genre: 'Hyperpop', city: 'Chicago, IL', score: 84, hype: 3100, overlap: '57%', ask: '$900 + 80/20 door', draw: 350 },
  { name: 'Dossier', genre: 'Electronic', city: 'Detroit, MI', score: 79, hype: 1920, overlap: '52%', ask: '$1,400 flat', draw: 400 },
  { name: 'Night Transit', genre: 'Shoegaze', city: 'Indianapolis, IN', score: 74, hype: 1100, overlap: '48%', ask: '$700 + door', draw: 150 },
];

const WHY_MATCH = [
  'High audience overlap with your existing listener base',
  'Draw estimate fits your room capacity with room to grow',
  'Genre alignment drives repeat attendance and HYPE density',
];

export function ViewTour({ data }: { data: WorkbenchData }) {
  const defaultMode: TourMode = data.activeProfileTypes.includes('VENUE') ? 'venue' : 'artist';
  const [mode, setMode] = useState<TourMode>(defaultMode);

  const [homeCity, setHomeCity] = useState(data.city || 'Chicago, IL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [radius, setRadius] = useState('250mi');
  const [genre, setGenre] = useState('');
  const [artistResults, setArtistResults] = useState<TourStop[] | null>(null);

  const [venueCapFilter, setVenueCapFilter] = useState<string>('Any');
  const [venueGenre, setVenueGenre] = useState('');
  const [venueDate, setVenueDate] = useState('');
  const [venueDraw, setVenueDraw] = useState<string>('');
  const [venueResults, setVenueResults] = useState<ArtistResult[] | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ArtistResult | null>(null);

  const [tourAdded, setTourAdded] = useState<Set<string>>(new Set());

  function handleFindStops() {
    setArtistResults(ARTIST_STOPS);
  }

  function handleFindArtists() {
    setVenueResults(VENUE_ARTISTS);
    setSelectedArtist(null);
  }

  function toggleAdded(city: string) {
    setTourAdded(prev => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city); else next.add(city);
      return next;
    });
  }

  const capOptions = ['<200', '200-400', '400+', 'Any'];
  const drawOptions = ['Local', 'Regional', 'Touring'];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Left panel */}
      <div style={{
        width: 360, flexShrink: 0, borderRight: '1px solid var(--line-2)',
        background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Mode toggle */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-3)', borderRadius: 10, padding: 4 }}>
            {(['artist', 'venue'] as TourMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setArtistResults(null); setVenueResults(null); setSelectedArtist(null); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  background: mode === m ? 'rgba(255,80,41,.12)' : 'transparent',
                  color: mode === m ? 'var(--ink)' : 'var(--ink-3)',
                  outline: mode === m ? '1px solid rgba(255,80,41,.22)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {m === 'artist' ? 'Artist' : 'Venue'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable filter area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {mode === 'artist' ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  Tour Route Planner
                </div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Find the best cities and venues for your next run
                </div>
              </div>

              <FilterLabel>Home City</FilterLabel>
              <input
                value={homeCity}
                onChange={e => setHomeCity(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Chicago, IL"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <FilterLabel>From</FilterLabel>
                  <input value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} placeholder="Jun 2025" />
                </div>
                <div>
                  <FilterLabel>To</FilterLabel>
                  <input value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} placeholder="Aug 2025" />
                </div>
              </div>

              <FilterLabel>Radius</FilterLabel>
              <select value={radius} onChange={e => setRadius(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {['100mi', '250mi', '500mi', 'National'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <FilterLabel>Genre / Vibe</FilterLabel>
              <input
                value={genre}
                onChange={e => setGenre(e.target.value)}
                style={{ ...inputStyle, marginBottom: 20 }}
                placeholder="e.g. Alt-R&B, Bedroom Pop"
              />

              <button onClick={handleFindStops} style={accentBtnStyle}>
                Find tour stops
              </button>

              {artistResults && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
                    {artistResults.length} stops · sorted by audience score
                  </div>
                  {artistResults.map(stop => (
                    <div key={stop.city} style={{
                      background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 10,
                      padding: '10px 12px', marginBottom: 8, cursor: 'default',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--f-d)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{stop.city}</span>
                        <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, color: '#ff5029' }}>{stop.score}</span>
                      </div>
                      {stop.dist !== '—' && (
                        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>{stop.dist} from home</div>
                      )}
                      <div style={{ height: 3, background: 'var(--line-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', width: `${stop.score}%`, background: '#ff5029', borderRadius: 99 }} />
                      </div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)' }}>reach: {stop.reach}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  Artist Booking Guide
                </div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Matched to your listener base &amp; room
                </div>
              </div>

              <FilterLabel>Capacity Range</FilterLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {capOptions.map(c => (
                  <button
                    key={c}
                    onClick={() => setVenueCapFilter(c)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700,
                      background: venueCapFilter === c ? 'rgba(255,80,41,.12)' : 'var(--bg-3)',
                      border: venueCapFilter === c ? '1px solid rgba(255,80,41,.3)' : '1px solid var(--line-2)',
                      color: venueCapFilter === c ? 'var(--ink)' : 'var(--ink-2)',
                    }}
                  >{c}</button>
                ))}
              </div>

              <FilterLabel>Genre</FilterLabel>
              <input value={venueGenre} onChange={e => setVenueGenre(e.target.value)} style={inputStyle} placeholder="e.g. Indie, Electronic" />

              <FilterLabel>Date</FilterLabel>
              <input value={venueDate} onChange={e => setVenueDate(e.target.value)} style={inputStyle} placeholder="Jul 2025" />

              <FilterLabel>Draw Range</FilterLabel>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {drawOptions.map(d => (
                  <button
                    key={d}
                    onClick={() => setVenueDraw(venueDraw === d ? '' : d)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700,
                      background: venueDraw === d ? 'rgba(255,80,41,.12)' : 'var(--bg-3)',
                      border: venueDraw === d ? '1px solid rgba(255,80,41,.3)' : '1px solid var(--line-2)',
                      color: venueDraw === d ? 'var(--ink)' : 'var(--ink-2)',
                    }}
                  >{d}</button>
                ))}
              </div>

              <button onClick={handleFindArtists} style={accentBtnStyle}>
                Find artists
              </button>

              {venueResults && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
                    {venueResults.length} matches
                  </div>
                  {venueResults.map(a => (
                    <div
                      key={a.name}
                      onClick={() => setSelectedArtist(a)}
                      style={{
                        background: selectedArtist?.name === a.name ? 'rgba(255,80,41,.06)' : 'var(--bg-3)',
                        border: selectedArtist?.name === a.name ? '1px solid rgba(255,80,41,.3)' : '1px solid var(--line-2)',
                        borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--f-d)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{a.name}</span>
                        <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, color: '#ff5029' }}>{a.score}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)' }}>{a.genre} · {a.city}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>overlap: {a.overlap} · draw: {a.draw}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {mode === 'artist' ? (
          artistResults ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                Tour Stops
              </div>
              <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', marginBottom: 24 }}>
                Ranked by audience score · tap a card to add to your tour
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {artistResults.map(stop => (
                  <div key={stop.city} style={{
                    background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 14,
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontFamily: 'var(--f-d)', fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>
                            {stop.city}
                          </div>
                          {stop.dist !== '—' && (
                            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{stop.dist} from home</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--f-d)', fontSize: 26, fontWeight: 800, color: '#ff5029', lineHeight: 1 }}>{stop.score}</div>
                          <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: 2 }}>AUDIENCE SCORE</div>
                        </div>
                      </div>
                      <div style={{ height: 5, background: 'var(--line-2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${stop.score}%`, background: 'linear-gradient(90deg, #ff5029, #ff3e9a)', borderRadius: 99 }} />
                      </div>
                    </div>

                    <div style={{ padding: '14px 20px' }}>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
                        Top Venues
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                        {stop.venues.map(v => (
                          <div key={v.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink)' }}>{v.n}</div>
                            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)' }}>{v.cap.toLocaleString()} cap</div>
                            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, color: '#22e5d4', minWidth: 38, textAlign: 'right' }}>{v.fit}%</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                        <StatCell label="Est. Reach" value={stop.reach} color="#ff3e9a" />
                        <StatCell label="Hype Density" value="High" color="#b983ff" />
                        <StatCell label="Avg Ticket" value="$18–24" color="#ffb84a" />
                      </div>

                      <button
                        onClick={() => toggleAdded(stop.city)}
                        style={{
                          width: '100%', padding: '11px 0', borderRadius: 10, cursor: 'pointer',
                          fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em',
                          background: tourAdded.has(stop.city) ? 'rgba(34,229,212,.1)' : '#ff5029',
                          border: tourAdded.has(stop.city) ? '1px solid rgba(34,229,212,.3)' : 'none',
                          color: tourAdded.has(stop.city) ? '#22e5d4' : '#fff',
                          minHeight: 44,
                          transition: 'all .15s',
                        }}
                      >
                        {tourAdded.has(stop.city) ? '✓ Added to tour' : 'Add to tour'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="🗺️" title="Set your filters to find your next tour" subtitle="Configure home city, dates, and radius to get city recommendations" />
          )
        ) : (
          selectedArtist ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{selectedArtist.name}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)' }}>{selectedArtist.genre} · {selectedArtist.city}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
                <BigStatCard label="HYPE" value={selectedArtist.hype.toLocaleString()} color="#ff5029" />
                <BigStatCard label="Audience Overlap" value={selectedArtist.overlap} color="#ff3e9a" />
                <BigStatCard label="Est. Draw" value={selectedArtist.draw.toString()} color="#22e5d4" />
                <BigStatCard label="Ask" value={selectedArtist.ask} color="#ffb84a" />
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
                <button style={{ ...accentBtnStyle, flex: 1 }}>Request Booking</button>
                <button style={{
                  flex: 1, padding: '13px 0', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em',
                  background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ink-2)',
                  minHeight: 44,
                }}>Save for later</button>
              </div>

              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 14 }}>
                  Why this match
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {WHY_MATCH.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5029', marginTop: 6, flexShrink: 0 }} />
                      <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>{pt}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon="🎤" title="Select an artist to see their profile" subtitle="Run a search and tap an artist card to view details and request a booking" />
          )
        )}
      </div>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6,
    }}>{children}</div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 15, fontWeight: 700, color, marginBottom: 3 }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function BigStatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 800, color, marginBottom: 4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 48px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: .4 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--f-d)', fontSize: 18, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)', maxWidth: 360, lineHeight: 1.6 }}>{subtitle}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 8,
  padding: '9px 12px', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13,
  marginBottom: 14, outline: 'none',
};

const accentBtnStyle: React.CSSProperties = {
  width: '100%', padding: '13px 0', borderRadius: 10, cursor: 'pointer',
  fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em',
  background: '#ff5029', border: 'none', color: '#fff', minHeight: 44,
};
