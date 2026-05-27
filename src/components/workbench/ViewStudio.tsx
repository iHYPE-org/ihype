'use client';

import React, { useState, useEffect } from 'react';
import type { WorkbenchData } from '@/components/WorkbenchShell';
import { IcHeart } from './icons';
import { Panel } from './primitives';

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

export function ViewStudio({ data }: { data: WorkbenchData }) {
  const payout = data.lifeStats?.totalEarnings ?? 0;
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● STUDIO · SHOW CREATOR · UPLOADS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Studio</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Upload tracks, build radio shows, track payouts. 45% of every ticket to you, always.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
      <CollabBoard />
    </div>
  );
}
