'use client';

import { useEffect, useState } from 'react';

type Comment = {
  id: string;
  createdAt: string;
  content: string;
  author: string;
};

export function ShowComments({ showId, canPost }: { showId: string; canPost: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/shows/${showId}/comments`);
      if (!res.ok) throw new Error('Could not load comments.');
      const json = (await res.json()) as { comments: Comment[] };
      setComments(json.comments ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Comments unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/shows/${showId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not post comment.');
      setDraft('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not post comment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <h2>Comments</h2>
      {canPost ? (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1500}
            placeholder="Share your thoughts about this show…"
            rows={3}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--bg-3)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              fontFamily: 'var(--f-b)'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="button small" type="submit" disabled={busy || !draft.trim()}>
              {busy ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <p className="meta">Sign in to leave a comment.</p>
      )}
      {err ? <p className="meta" style={{ color: 'var(--accent)' }}>{err}</p> : null}
      {loading ? (
        <p className="meta">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="meta">No comments yet — be the first.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {comments.map((c) => (
            <li
              key={c.id}
              className="panel"
              style={{ padding: '10px 14px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{c.author}</strong>
                <span className="meta" style={{ fontSize: 11 }}>
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{c.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
