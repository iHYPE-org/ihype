'use client';

import React, { useState, useEffect } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShellV2';
import { ArtistMediaUploadManager } from '@/components/ArtistMediaUploadManager';
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

// Static venue pings — venue demand radar is not yet in the DB
const STATIC_VENUE_PINGS: HypeHeatmapVenuePing[] = [];

function HypeHeatmapLive() {
  const [cities, setCities] = useState<HypeHeatmapCity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hype/heatmap')
      .then((r) => r.json())
      .then((data: { cities: Array<{ city: string; count: number; rank: number }> }) => {
        const maxCount = data.cities[0]?.count ?? 1;
        let fallbackIndex = 0;
        const mapped = data.cities.map((c) => {
          const item = cityToHeatmapCity(c.city, c.count, c.rank, maxCount, fallbackIndex);
          if (!CITY_COORDS[c.city]) fallbackIndex++;
          return item;
        });
        setCities(mapped);
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
      venuePings={STATIC_VENUE_PINGS}
    />
  );
}

type CollabBoardPost = {
  id: string;
  userId: string;
  type: string;
  role: string;
  body: string;
  contact?: string | null;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  drummer: '#ff5029',
  venue: '#22e5d4',
  vocalist: '#b983ff',
  producer: '#ff3e9a',
  guitarist: '#ffb84a',
  bassist: '#ffb84a',
  DJ: '#b983ff',
  other: 'var(--ink-3)',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const ROLES = ['drummer', 'vocalist', 'producer', 'guitarist', 'bassist', 'venue', 'DJ', 'other'];

function CollabBoard() {
  const [tab, setTab] = useState<'browse' | 'post'>('browse');
  const [posts, setPosts] = useState<CollabBoardPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formType, setFormType] = useState('looking-for');
  const [formRole, setFormRole] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formContact, setFormContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetch('/api/collab/board')
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRole) { setFormError('Please select a role.'); return; }
    if (!formBody.trim()) { setFormError('Please enter a description.'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/collab/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: formType, role: formRole, body: formBody, contact: formContact }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Failed to post.'); return; }
      // Optimistic add to list
      setPosts((prev: CollabBoardPost[]) => [data.post, ...prev]);
      setFormType('looking-for');
      setFormRole('');
      setFormBody('');
      setFormContact('');
      setTab('browse');
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 18px',
    borderRadius: 6,
    fontFamily: 'var(--f-m)',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '.04em',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--bg)' : 'var(--ink-2)',
    transition: 'background .15s, color .15s',
  });

  return (
    <div style={{ marginTop: 32, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 6 }}>🤝 COLLAB BOARD</div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: 'var(--ink)', marginBottom: 14 }}>Connect with artists &amp; venues</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: -1 }}>
          <button style={tabStyle(tab === 'browse')} onClick={() => setTab('browse')}>Browse posts</button>
          <button style={tabStyle(tab === 'post')} onClick={() => setTab('post')}>Post a request</button>
        </div>
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <div style={{ padding: '20px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>Loading…</div>
          )}
          {!loading && posts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)' }}>
              No posts yet — be the first to connect
            </div>
          )}
          {!loading && posts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {posts.map(post => (
                <div key={post.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '14px 18px', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 20,
                      fontFamily: 'var(--f-m)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      background: (ROLE_COLORS[post.role] ?? 'var(--ink-3)') + '22',
                      color: ROLE_COLORS[post.role] ?? 'var(--ink-3)',
                      border: `1px solid ${ROLE_COLORS[post.role] ?? 'var(--ink-3)'}44`,
                    }}>{post.role}</span>
                    <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>
                      {post.type === 'looking-for' ? 'Looking for' : 'Available'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>{relativeTime(post.createdAt)}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>{post.body}</div>
                  {post.contact && (
                    <div style={{ marginTop: 8, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--accent)' }}>📬 {post.contact}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post tab */}
      {tab === 'post' && (
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, letterSpacing: '.04em' }}>TYPE</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13 }}
              >
                <option value="looking-for">I&apos;m looking for…</option>
                <option value="available">I&apos;m available as…</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, letterSpacing: '.04em' }}>ROLE</label>
              <select
                value={formRole}
                onChange={e => setFormRole(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13 }}
              >
                <option value="">Select a role…</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, letterSpacing: '.04em' }}>
              DESCRIPTION <span style={{ float: 'right', color: formBody.length > 450 ? '#ff3e9a' : 'var(--ink-3)' }}>{formBody.length}/500</span>
            </label>
            <textarea
              value={formBody}
              onChange={e => setFormBody(e.target.value.slice(0, 500))}
              placeholder="Tell people what you're looking for or what you bring to the table…"
              rows={4}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, letterSpacing: '.04em' }}>CONTACT <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(optional)</span></label>
            <input
              type="text"
              value={formContact}
              onChange={e => setFormContact(e.target.value.slice(0, 100))}
              placeholder="Instagram, email, etc."
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          {formError && (
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ff3e9a' }}>{formError}</div>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '11px 24px',
              borderRadius: 8,
              fontFamily: 'var(--f-m)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              background: submitting ? 'var(--line)' : 'linear-gradient(135deg, var(--accent), var(--pink, #ff3e9a))',
              color: submitting ? 'var(--ink-3)' : '#fff',
              alignSelf: 'flex-start',
              transition: 'background .15s',
            }}
          >
            {submitting ? 'Posting…' : 'Post request'}
          </button>
        </form>
      )}
    </div>
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

export function ViewStudio({ data }: { data: WorkbenchData }) {
  const payout = data.lifeStats?.totalEarnings ?? 0;
  const [studioTab, setStudioTab] = useState<'uploads' | 'hypemap'>('uploads');

  const tabBtn = (id: typeof studioTab, label: string) => (
    <button
      key={id}
      onClick={() => setStudioTab(id)}
      style={{
        padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
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
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● STUDIO · SHOW CREATOR · UPLOADS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Studio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Upload tracks, build radio shows, track payouts. 45% of every ticket to you, always.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
        {tabBtn('uploads', 'UPLOADS')}
        {tabBtn('hypemap', 'HYPE MAP')}
      </div>

      {studioTab === 'hypemap' && <HypeHeatmapLive />}

      {studioTab === 'uploads' && <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Uploads">
          <div style={{ padding: '4px 0' }}>
            {data.tracks.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '40px 24px', gap: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 40 }}>🎵</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>No uploads yet</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '24ch', lineHeight: 1.5 }}>
                  Drag an audio file here or click to upload your first track.
                </div>
                <button style={{
                  marginTop: 4, padding: '11px 24px', borderRadius: 9,
                  fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: '#fff',
                  background: 'linear-gradient(135deg, var(--accent), var(--pink, #ff3e9a))',
                }}>Upload a track</button>
              </div>
            ) : (
              data.tracks.slice(0, 4).map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 5, background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t.title}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t.artistName} · {t.duration}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--f-m)', fontSize: 13, color: '#ff3e9a' }}>
                    <IcHeart s={10} c="#ff3e9a" /> {t.hypeCount}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '24px 28px' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.16em', color: 'var(--ink-3)', marginBottom: 8 }}>PAYOUT PENDING</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.025em', color: 'var(--ink)' }}>${payout.toLocaleString()}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: '#ffb84a', letterSpacing: '.04em', marginTop: 6 }}>pending · next release</div>
          <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.04em' }}>
            45% tickets · 45% venue · 10% referrer · $0 platform fee
          </div>
          <button style={{ marginTop: 14, width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>
            + New show
          </button>
        </div>
      </div>
      {data.profileId && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 14 }}>UPLOAD TRACKS</div>
          <ArtistMediaUploadManager profileId={data.profileId} />
        </div>
      )}
      <CollabBoard />
      <PassedTheAux data={data} /></>}
    </div>
  );
}
