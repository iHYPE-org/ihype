'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShellV2';
import { HypeHeatmap } from '@/components/HypeHeatmap';
import type { HypeHeatmapCity, HypeHeatmapVenuePing } from '@/components/HypeHeatmap';
import { IcHeart } from './icons';
import { Panel } from './primitives';

// ── City coordinate lookup (normalized 0..1 within a US bounding box) ──
// x = (lng + 125) / 57,  y = (50 - lat) / 27  (approx CONUS bounding box)
const CITY_COORDS: Record<string, { x: number; y: number }> = {
  'New York':        { x: 0.84, y: 0.35 },
  'Brooklyn':        { x: 0.84, y: 0.36 },
  'Los Angeles':     { x: 0.09, y: 0.62 },
  'Chicago':         { x: 0.55, y: 0.30 },
  'Houston':         { x: 0.44, y: 0.75 },
  'Phoenix':         { x: 0.20, y: 0.63 },
  'Philadelphia':    { x: 0.82, y: 0.37 },
  'San Antonio':     { x: 0.42, y: 0.78 },
  'San Diego':       { x: 0.10, y: 0.65 },
  'Dallas':          { x: 0.45, y: 0.68 },
  'San Jose':        { x: 0.06, y: 0.47 },
  'Austin':          { x: 0.44, y: 0.73 },
  'Jacksonville':    { x: 0.74, y: 0.68 },
  'Fort Worth':      { x: 0.45, y: 0.68 },
  'Columbus':        { x: 0.68, y: 0.38 },
  'Charlotte':       { x: 0.73, y: 0.50 },
  'San Francisco':   { x: 0.06, y: 0.45 },
  'Indianapolis':    { x: 0.63, y: 0.38 },
  'Seattle':         { x: 0.08, y: 0.14 },
  'Denver':          { x: 0.31, y: 0.43 },
  'Nashville':       { x: 0.62, y: 0.53 },
  'Oklahoma City':   { x: 0.43, y: 0.60 },
  'El Paso':         { x: 0.29, y: 0.70 },
  'Washington':      { x: 0.80, y: 0.42 },
  'Las Vegas':       { x: 0.16, y: 0.55 },
  'Louisville':      { x: 0.64, y: 0.46 },
  'Memphis':         { x: 0.57, y: 0.58 },
  'Portland':        { x: 0.08, y: 0.20 },
  'Baltimore':       { x: 0.80, y: 0.41 },
  'Milwaukee':       { x: 0.58, y: 0.28 },
  'Detroit':         { x: 0.67, y: 0.30 },
  'Atlanta':         { x: 0.68, y: 0.60 },
  'Miami':           { x: 0.77, y: 0.82 },
  'Minneapolis':     { x: 0.50, y: 0.20 },
  'Cleveland':       { x: 0.70, y: 0.34 },
  'New Orleans':     { x: 0.57, y: 0.74 },
  'Boston':          { x: 0.88, y: 0.29 },
  'Pittsburgh':      { x: 0.74, y: 0.37 },
  'Kansas City':     { x: 0.50, y: 0.48 },
  'St. Louis':       { x: 0.56, y: 0.47 },
  'Tampa':           { x: 0.73, y: 0.76 },
  'Orlando':         { x: 0.75, y: 0.74 },
  'Cincinnati':      { x: 0.66, y: 0.42 },
  'Raleigh':         { x: 0.77, y: 0.49 },
  'Sacramento':      { x: 0.08, y: 0.43 },
  'Salt Lake City':  { x: 0.22, y: 0.38 },
  'Richmond':        { x: 0.79, y: 0.44 },
};

function cityToHeatmapCity(
  city: string,
  count: number,
  rank: number,
  maxCount: number,
  fallbackIndex: number,
): HypeHeatmapCity {
  const coords = CITY_COORDS[city] ?? {
    // Spread unknown cities in a row near the bottom so they don't overlap
    x: 0.1 + (fallbackIndex % 9) * 0.09,
    y: 0.88,
  };
  return {
    name: city,
    x: coords.x,
    y: coords.y,
    hype: count,
    venuesAsking: 0,
    hot: rank <= 3 && count > maxCount * 0.5,
  };
}

function HypeHeatmapLive() {
  const [cities, setCities] = useState<HypeHeatmapCity[]>([]);
  const [venuePings, setVenuePings] = useState<HypeHeatmapVenuePing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/hype/heatmap').then((r) => r.json()),
      fetch('/api/hype/venue-pings').then((r) => r.json()),
    ])
      .then(([heatmapData, pingsData]: [
        { cities: Array<{ city: string; count: number; rank: number }> },
        { pings: HypeHeatmapVenuePing[] }
      ]) => {
        const maxCount = heatmapData.cities[0]?.count ?? 1;
        let fallbackIndex = 0;
        const mapped = heatmapData.cities.map((c) => {
          const item = cityToHeatmapCity(c.city, c.count, c.rank, maxCount, fallbackIndex);
          if (!CITY_COORDS[c.city]) fallbackIndex++;
          return item;
        });
        setCities(mapped);
        setVenuePings(pingsData.pings ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 300, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)',
        letterSpacing: '.06em',
      }}>
        Loading hype data…
      </div>
    );
  }

  if (cities.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 300, fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)',
      }}>
        No hype events in the last 30 days yet.
      </div>
    );
  }

  return (
    <HypeHeatmap
      cities={cities}
      venuePings={venuePings}
    />
  );
}

type AuxQueueSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

function PassedTheAux({ data }: { data: WorkbenchData }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queueName, setQueueName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [pastQueues, setPastQueues] = useState<AuxQueueSummary[]>([]);
  const [copiedSlug, setCopiedSlug] = useState('');

  useEffect(() => {
    fetch('/api/aux')
      .then(r => r.json())
      .then(d => setPastQueues(d.queues ?? []))
      .catch(() => {});
  }, []);

  function toggleTrack(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!queueName.trim() || selected.size === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/aux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: queueName.trim(), trackIds: Array.from(selected) }),
      });
      const json = await res.json();
      if (res.ok) {
        const fullUrl = `${window.location.origin}${json.url}`;
        setCreatedUrl(fullUrl);
        setPastQueues(prev => [json.queue, ...prev].slice(0, 5));
        setSelected(new Set());
        setQueueName('');
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function copyUrl(url: string, slug?: string) {
    try {
      await navigator.clipboard.writeText(url);
      if (slug) { setCopiedSlug(slug); setTimeout(() => setCopiedSlug(''), 1500); }
      else { setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch {}
  }

  const tracks = data.tracks ?? [];

  return (
    <div style={{ marginTop: 32, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 6 }}>🎧 PASSED THE AUX</div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>Build a shareable set</div>
        <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Share your set — fans who discover through your link earn you referral credit on ticket sales
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {tracks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)' }}>
            Upload tracks first to build a set
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.04em', marginBottom: 10 }}>SELECT TRACKS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tracks.map(t => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${selected.has(t.id) ? 'var(--accent)' : 'var(--line)'}`, background: selected.has(t.id) ? 'var(--accent)11' : 'var(--bg)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleTrack(t.id)} style={{ accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0 }} />
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>{t.artistName}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              <input
                type="text"
                value={queueName}
                onChange={e => setQueueName(e.target.value.slice(0, 80))}
                placeholder="Name your set…"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, boxSizing: 'border-box' }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !queueName.trim() || selected.size === 0}
                style={{ padding: '9px 20px', borderRadius: 7, border: 'none', cursor: (creating || !queueName.trim() || selected.size === 0) ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, var(--accent), var(--pink, #ff3e9a))', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.04em', whiteSpace: 'nowrap', opacity: (creating || !queueName.trim() || selected.size === 0) ? 0.5 : 1 }}
              >
                {creating ? 'Creating…' : 'Create aux link'}
              </button>
            </div>

            {createdUrl && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--accent)44', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--accent)', marginBottom: 6, letterSpacing: '.04em' }}>YOUR AUX LINK IS READY</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', wordBreak: 'break-all' }}>{createdUrl}</span>
                  <button onClick={() => copyUrl(createdUrl)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {pastQueues.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.04em', marginBottom: 10 }}>PAST SETS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastQueues.slice(0, 5).map(q => {
                const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://ihype.org'}/aux/${q.slug}`;
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)' }}>
                    <span style={{ flex: 1, fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
                    <a href={`/aux/${q.slug}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View</a>
                    <button onClick={() => copyUrl(url, q.slug)} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: 'var(--bg-2)', color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 12, cursor: 'pointer' }}>
                      {copiedSlug === q.slug ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Show creator form ─────────────────────────────────────────
type RawShow = {
  id: string; slug: string; title: string; status: string;
  startsAt: string; isTicketed: boolean; isRadioShow: boolean;
  ticketCapacity: number | null; ticketsSoldCount: number;
  venueProfile?: { name: string } | null;
  headlinerProfile?: { name: string } | null;
};

type BookingReq = {
  id: string; message: string; status: string; createdAt: string;
  fromUser?: { name: string | null; profiles?: Array<{ name: string; type: string; id: string }> } | null;
  toProfile?: { name: string; type: string; id: string } | null;
};

function ShowCreator({ data }: { data: WorkbenchData }) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isTicketed, setIsTicketed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);
  const [myShows, setMyShows] = useState<RawShow[]>([]);

  const profileId = data.profileId;
  const profileType = data.profileType;
  const isCreator = profileType === 'ARTIST' || profileType === 'DJ' || profileType === 'VENUE';

  const fetchMyShows = useCallback(async () => {
    try {
      const res = await fetch('/api/shows?mine=1');
      const d = await res.json();
      if (Array.isArray(d)) setMyShows((d as RawShow[]).filter(s => !s.isRadioShow));
    } catch {}
  }, []);

  useEffect(() => { if (isCreator) void fetchMyShows(); }, [isCreator, fetchMyShows]);

  if (!isCreator) {
    return (
      <div style={{ padding: '28px 24px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>
          Create an artist, promoter, or venue profile to create shows.
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) { setStatus('Title and date are required.'); return; }
    setSubmitting(true);
    setStatus('');
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        status: 'SCHEDULED',
        isTicketed,
      };
      if (profileType === 'VENUE') body.venueProfileId = profileId;
      else body.headlinerProfileId = profileId;
      if (isTicketed && ticketPrice) body.ticketPriceCents = Math.round(Number(ticketPrice) * 100);
      if (isTicketed && capacity) body.ticketCapacity = Number(capacity);

      const res = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not create show.');
      setCreated({ id: payload.id ?? '', slug: payload.slug ?? '' });
      setTitle(''); setStartsAt(''); setTicketPrice(''); setCapacity(''); setIsTicketed(false);
      void fetchMyShows();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not create show.');
    } finally {
      setSubmitting(false);
    }
  }

  const statusColor: Record<string, string> = {
    SCHEDULED: '#22e5d4', LIVE: '#ff5029', DRAFT: 'var(--ink-3)', ENDED: 'var(--ink-3)', CANCELED: '#ff3e9a',
  };

  return (
    <>
      <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', color: 'var(--accent)', marginBottom: 4 }}>📅 SHOW CREATOR</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>Create a show</div>
        </div>
        <form onSubmit={e => void submit(e)} style={{ padding: '18px 20px', display: 'grid', gap: 12 }}>
          {created && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(34,229,212,.08)', border: '1px solid rgba(34,229,212,.25)', fontFamily: 'var(--f-m)', fontSize: 13, color: '#22e5d4' }}>
              ✓ Show created!{' '}
              <a href={`/shows/${created.slug}`} target="_blank" rel="noreferrer" style={{ color: '#22e5d4', fontWeight: 700 }}>View show →</a>
            </div>
          )}
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 5 }}>Show title</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Friday Night Sessions" required
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, boxSizing: 'border-box' }} />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 5 }}>Date &amp; time</span>
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, boxSizing: 'border-box' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={isTicketed} onChange={e => setIsTicketed(e.target.checked)} style={{ width: 16, height: 16 }} />
            Enable ticketing
          </label>
          {isTicketed && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 5 }}>Ticket price ($)</span>
                <input type="number" min="0" step="0.01" value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 5 }}>Capacity</span>
                <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 200"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, boxSizing: 'border-box' }} />
              </label>
            </div>
          )}
          {status && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ffb4a7' }}>{status}</div>}
          <button type="submit" disabled={submitting}
            style={{ padding: '11px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--accent), #ff3e9a)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 800, cursor: submitting ? 'wait' : 'pointer', alignSelf: 'flex-start' }}>
            {submitting ? 'Creating…' : 'Create show'}
          </button>
        </form>
      </div>

      {/* Schedule list */}
      {myShows.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', fontWeight: 700 }}>
            MY SCHEDULE · {myShows.length} SHOW{myShows.length !== 1 ? 'S' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {myShows.map((s, i) => {
              const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(s.startsAt));
              const venue = s.venueProfile?.name ?? (s.headlinerProfile?.name ? `with ${s.headlinerProfile.name}` : '');
              const sold = s.isTicketed ? `${s.ticketsSoldCount}/${s.ticketCapacity ?? '?'} sold` : 'Free entry';
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: i < myShows.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.04em' }}>{date}{venue ? ` · ${venue}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: statusColor[s.status] ?? 'var(--ink-3)' }}>{s.status}</span>
                    {s.isTicketed && <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{sold}</span>}
                  </div>
                  <a href={`/shows/${s.slug}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}>View →</a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Bookings tab ──────────────────────────────────────────────
function BookingsTab() {
  const [received, setReceived] = useState<BookingReq[]>([]);
  const [sent, setSent] = useState<BookingReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/booking-requests');
      const d = await res.json() as { received?: BookingReq[]; sent?: BookingReq[] };
      setReceived(d.received ?? []);
      setSent(d.sent ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function respond(id: string, status: 'accepted' | 'declined') {
    setPatchingId(id);
    try {
      await fetch('/api/booking-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      void fetchAll();
    } catch {}
    finally { setPatchingId(null); }
  }

  const statusBadge = (s: string) => {
    const cfg: Record<string, { color: string; bg: string }> = {
      pending:  { color: '#ffb84a', bg: 'rgba(255,184,74,.12)' },
      accepted: { color: '#22e5d4', bg: 'rgba(34,229,212,.12)' },
      declined: { color: 'var(--ink-3)', bg: 'rgba(255,255,255,.05)' },
    };
    const c = cfg[s] ?? cfg.pending;
    return (
      <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', padding: '2px 7px', borderRadius: 99, background: c.bg, color: c.color }}>
        {s.toUpperCase()}
      </span>
    );
  };

  if (loading) return <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>Loading…</div>;

  const noData = received.length === 0 && sent.length === 0;
  if (noData) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>
      No booking requests yet. Use the Matchmaker to send your first request.
    </div>
  );

  const cardStyle = { border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', marginBottom: 24 };
  const rowStyle = (last: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: last ? 'none' : '1px solid var(--line)' });

  return (
    <div style={{ marginTop: 4 }}>
      {received.length > 0 && (
        <div style={cardStyle}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', fontWeight: 700 }}>
            RECEIVED · {received.length}
          </div>
          {received.map((r, i) => {
            const senderProfile = r.fromUser?.profiles?.[0];
            const senderName = senderProfile?.name ?? r.fromUser?.name ?? 'Someone';
            return (
              <div key={r.id} style={rowStyle(i === received.length - 1)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{senderName}</span>
                    {statusBadge(r.status)}
                  </div>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: r.status === 'pending' ? 10 : 0 }}>{r.message || 'No message provided.'}</div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button disabled={patchingId === r.id} onClick={() => void respond(r.id, 'accepted')}
                        style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: 'rgba(34,229,212,.15)', color: '#22e5d4', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Accept
                      </button>
                      <button disabled={patchingId === r.id} onClick={() => void respond(r.id, 'declined')}
                        style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid var(--line)', background: 'none', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 12, cursor: 'pointer' }}>
                        Decline
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
                  {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(r.createdAt))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sent.length > 0 && (
        <div style={cardStyle}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', fontWeight: 700 }}>
            SENT · {sent.length}
          </div>
          {sent.map((r, i) => (
            <div key={r.id} style={rowStyle(i === sent.length - 1)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{r.toProfile?.name ?? 'Unknown'}</span>
                  {statusBadge(r.status)}
                </div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{r.message || 'No message.'}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
                {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(r.createdAt))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Uploads tab ───────────────────────────────────────────────
type MediaAsset = {
  hexId: string; title: string; notes: string | null; mimeType: string;
  fileSizeBytes: number; freeUseEnabled: boolean; createdAt: string;
};

function UploadsTab({ data }: { data: WorkbenchData }) {
  const profileId = data.profileId;
  const isArtist = data.profileType === 'ARTIST';
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [freeUse, setFreeUse] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profileId || !isArtist) { setLoading(false); return; }
    fetch(`/api/artist-media?profileId=${encodeURIComponent(profileId)}`)
      .then(r => r.json())
      .then((d: { tracks?: MediaAsset[] }) => { setAssets(d.tracks ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId, isArtist]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !profileId) return;
    setUploading(true); setErr('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('profileId', profileId);
    fd.append('title', title || file.name);
    fd.append('freeUseEnabled', String(freeUse));
    try {
      const res = await fetch('/api/artist-media', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? 'Upload failed.'); return; }
      setAssets(prev => [json.asset as MediaAsset, ...prev]);
      setFile(null); setTitle(''); setFreeUse(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch { setErr('Upload failed.'); }
    finally { setUploading(false); }
  }

  function fmtSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!isArtist) {
    return (
      <div style={{ padding: '28px 0', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>
        Music uploads are available for artist profiles.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      {/* Upload form */}
      <form onSubmit={e => void handleUpload(e)} style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', color: 'var(--accent)', marginBottom: 4 }}>🎵 UPLOAD TRACK</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>Add music</div>
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gap: 12 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${file ? 'var(--accent)' : 'rgba(255,255,255,.12)'}`, borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: file ? 'rgba(255,80,41,.04)' : 'transparent', transition: 'all .14s' }}>
            <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { setFile(e.target.files?.[0] ?? null); setTitle(e.target.files?.[0]?.name.replace(/\.[^.]+$/, '') ?? ''); }} />
            <div style={{ fontSize: 22, marginBottom: 6 }}>🎵</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>{file ? file.name : 'Click to choose audio'}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em' }}>MP3, WAV, FLAC — max 10 MB</div>
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Track title"
            style={{ padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, boxSizing: 'border-box' as const }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={freeUse} onChange={e => setFreeUse(e.target.checked)} style={{ width: 15, height: 15 }} />
            Free-use — other creators can use this track
          </label>
          {err && <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff5029' }}>{err}</div>}
          <button type="submit" disabled={uploading || !file}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,var(--accent),#ff3e9a)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 800, cursor: (uploading || !file) ? 'not-allowed' : 'pointer', opacity: (!file) ? 0.5 : 1, alignSelf: 'flex-start' }}>
            {uploading ? 'Uploading…' : 'Upload track'}
          </button>
        </div>
      </form>

      {/* Track list */}
      {loading ? (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', padding: '12px 0' }}>Loading uploads…</div>
      ) : assets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>No uploads yet — add your first track above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assets.map(a => (
            <div key={a.hexId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg-2)' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🎵</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{fmtSize(a.fileSizeBytes)} · {a.mimeType.replace('audio/', '').toUpperCase()}{a.freeUseEnabled ? ' · Free use' : ''}</div>
              </div>
              <a href={`/api/media/${a.hexId}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}>▶ Play</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Payouts tab ────────────────────────────────────────────────
function PayoutsTab({ data }: { data: WorkbenchData }) {
  const life = data.lifeStats;
  const ref = data.referralStats;
  const totalCents = (life?.totalEarnings ?? 0) * 100;
  const refPayoutCents = ref?.payoutCents ?? 0;
  const ticketCents = totalCents - refPayoutCents;

  function fmt(cents: number) {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const splits = [
    { label: 'Ticket sales (45%)', value: fmt(ticketCents), color: 'var(--accent)', pct: totalCents > 0 ? (ticketCents / totalCents) * 100 : 45 },
    { label: 'Referral commissions (10%)', value: fmt(refPayoutCents), color: '#b983ff', pct: totalCents > 0 ? (refPayoutCents / totalCents) * 100 : 10 },
  ];

  return (
    <div style={{ marginTop: 4 }}>
      {/* Summary card */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '24px 28px', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', color: 'var(--accent)', marginBottom: 8 }}>💰 LIFETIME EARNINGS</div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 44, letterSpacing: '-.03em', color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>{fmt(totalCents)}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>$0 platform fee · iHYPE keeps nothing</div>
      </div>

      {/* Split breakdown */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 16, fontWeight: 700 }}>REVENUE BREAKDOWN</div>
        {splits.map(s => (
          <div key={s.label} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)' }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: s.color }}>{s.value}</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, s.pct)}%`, background: s.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Total</span>
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>{fmt(totalCents)}</span>
        </div>
      </div>

      {/* Referral stats */}
      {ref && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '20px 24px' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 16, fontWeight: 700 }}>🔗 REFERRAL PROGRAMME</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { label: 'Link clicks', value: ref.clicks.toLocaleString(), color: '#7fb3ff' },
              { label: 'Buyers', value: ref.buyers.toLocaleString(), color: '#22e5d4' },
              { label: 'Your cut', value: fmt(ref.payoutCents), color: '#b983ff' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 16px', borderRadius: 9, background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)' }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase' as const }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            Share your iHYPE link and earn 10% of every ticket sold through your referral — paid out automatically at month end.
          </div>
        </div>
      )}
    </div>
  );
}

export function ViewStudio({ data }: { data: WorkbenchData }) {
  const payout = data.lifeStats?.totalEarnings ?? 0;
  const [studioTab, setStudioTab] = useState<'sets' | 'shows' | 'bookings' | 'hypemap' | 'uploads' | 'payouts'>('sets');

  const tabBtn = (id: typeof studioTab, label: string) => (
    <button
      key={id}
      onClick={() => setStudioTab(id)}
      style={{
        padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
        background: studioTab === id ? 'rgba(255,80,41,.12)' : 'transparent',
        color: studioTab === id ? 'var(--accent)' : 'var(--ink-3)',
        borderBottom: studioTab === id ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'all .15s',
      }}
    >{label}</button>
  );

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● STUDIO · RADIO SHOWS · EVENTS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Studio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>
          Build sets from your playlist, create ticketed shows, and earn on every ticket. Open to everyone — no signup required as a promoter.
        </p>
      </div>

      {/* Payout bar — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-3)', marginBottom: 2 }}>PAYOUT PENDING</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.025em', color: 'var(--ink)', lineHeight: 1 }}>${payout.toLocaleString()}</div>
        </div>
        <div style={{ width: 1, height: 36, background: 'var(--line)', flexShrink: 0 }} />
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.02em', flex: 1 }}>
          45% tickets · 45% venue · 10% referrer · $0 platform fee
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line)', marginBottom: 20, flexWrap: 'wrap' }}>
        {tabBtn('sets', 'BUILD A SET')}
        {tabBtn('shows', 'CREATE SHOW')}
        {tabBtn('bookings', 'BOOKINGS')}
        {tabBtn('uploads', 'UPLOADS')}
        {tabBtn('payouts', 'PAYOUTS')}
        {tabBtn('hypemap', 'HYPE MAP')}
      </div>

      {studioTab === 'sets' && <PassedTheAux data={data} />}
      {studioTab === 'shows' && <ShowCreator data={data} />}
      {studioTab === 'bookings' && <BookingsTab />}
      {studioTab === 'uploads' && <UploadsTab data={data} />}
      {studioTab === 'payouts' && <PayoutsTab data={data} />}
      {studioTab === 'hypemap' && <HypeHeatmapLive />}
    </div>
  );
}
