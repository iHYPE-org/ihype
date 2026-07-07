'use client';

import { useEffect, useState } from 'react';

type FeatureRequest = {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: string;
  createdAt: string;
};

const rowStyle: React.CSSProperties = {
  display: 'flex', gap: 14, alignItems: 'flex-start',
  padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.06)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-body, DM Sans, sans-serif)', fontSize: 14,
  color: 'var(--ink)', background: 'var(--bg-3)', border: '1px solid var(--line-2)',
  borderRadius: 9, padding: '11px 13px', outline: 'none',
};

const STATUS_COLOR: Record<string, string> = {
  planned: '#22e5d4',
  in_progress: '#b983ff',
  shipped: '#22e5d4',
  declined: 'rgba(240,235,229,.4)',
};

/**
 * The real, counted vote-and-suggest mechanism behind Community's "you get a
 * vote" charter promise — moved here from the standalone (and old-themed)
 * /feedback page so Community itself is the actual conduit, not just a link
 * out to one. Backed by the same GET/POST /api/feedback (FeatureRequest
 * model) that page always used.
 */
export function CommunityVoteBoard() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/feedback')
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function vote(id: string) {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', id }),
    });
    if (res.ok) {
      const data = await res.json();
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, votes: data.votes } : r)).sort((a, b) => b.votes - a.votes));
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? 'Could not register that vote.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    if (res.ok) {
      const data = await res.json();
      setRequests((prev) => [data.request, ...prev]);
      setTitle('');
      setDescription('');
      setMessage('Submitted — thanks for the idea.');
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? 'Could not submit that idea.');
    }
  }

  return (
    <div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <input
          style={inputStyle}
          placeholder="Short title for your idea"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
        />
        <textarea
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Describe what you'd want built."
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
        {message && <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0 }}>{message}</p>}
        <button className="ihype-btn-primary" type="submit" style={{ alignSelf: 'flex-start', padding: '11px 22px' }}>
          Submit idea
        </button>
      </form>

      {loading ? (
        <p style={{ fontSize: 13, color: 'rgba(240,235,229,.45)' }}>Loading…</p>
      ) : requests.length === 0 ? (
        <p style={{ fontSize: 13, color: 'rgba(240,235,229,.45)' }}>No feature requests yet — be the first to suggest one.</p>
      ) : (
        <div>
          {requests.map((fr) => (
            <div key={fr.id} style={rowStyle}>
              <button
                onClick={() => vote(fr.id)}
                type="button"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  minWidth: 48, padding: '8px 6px', borderRadius: 9, flexShrink: 0,
                  border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
                  color: 'var(--ink)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>▲</span>
                <span style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{fr.votes}</span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fr.title}</div>
                <p style={{ fontSize: 13, color: 'rgba(240,235,229,.6)', margin: '4px 0 0', lineHeight: 1.5 }}>{fr.description}</p>
              </div>
              {fr.status !== 'open' && (
                <span
                  style={{
                    flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                    letterSpacing: '.08em', padding: '4px 9px', borderRadius: 999,
                    border: `1px solid ${STATUS_COLOR[fr.status] ?? 'rgba(255,255,255,.14)'}`,
                    color: STATUS_COLOR[fr.status] ?? 'rgba(240,235,229,.6)',
                  }}
                >
                  {fr.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
