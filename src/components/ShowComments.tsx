'use client';

import { useEffect, useState } from 'react';

type Reaction = { emoji: string; count: number };

type Comment = {
  id: string;
  createdAt: string;
  content: string;
  author: string;
  reactions: Reaction[];
};

const EMOJIS = ['👍', '❤️', '🔥'];

export function ShowComments({
  showId,
  canPost,
  isLive = false,
  goingCount = null
}: {
  showId: string;
  canPost: boolean;
  isLive?: boolean;
  goingCount?: number | null;
}) {
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

  // While the show is LIVE, refresh comments every 15s — but only while the tab is visible.
  useEffect(() => {
    if (!isLive) return;
    let intervalId: number | null = null;
    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const start = () => {
      if (intervalId === null) {
        intervalId = window.setInterval(() => void load(), 15_000);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, showId]);

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

  async function toggleReaction(commentId: string, emoji: string) {
    if (!canPost) return;
    try {
      const res = await fetch(`/api/shows/${showId}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
      if (!res.ok) return;
      const json = (await res.json()) as { reactions: Reaction[] };
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, reactions: json.reactions ?? [] } : c
        )
      );
    } catch {
      // ignore
    }
  }

  return (
    <section className="section">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Comments</h2>
        {typeof goingCount === 'number' && goingCount > 0 ? (
          <span className="meta">{goingCount} going</span>
        ) : null}
        {isLive ? (
          <span className="meta" style={{ color: 'var(--accent)' }}>● Live — updating automatically</span>
        ) : null}
      </div>
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
              <p style={{ margin: '4px 0 6px', whiteSpace: 'pre-wrap' }}>{c.content}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOJIS.map((emoji) => {
                  const rx = c.reactions.find((r) => r.emoji === emoji);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => void toggleReaction(c.id, emoji)}
                      style={{
                        background: 'var(--bg-3)',
                        border: '1px solid var(--line)',
                        borderRadius: 20,
                        padding: '2px 8px',
                        fontSize: 13,
                        cursor: canPost ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      {emoji}
                      {rx && rx.count > 0 ? (
                        <span style={{ fontSize: 11 }}>{rx.count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
