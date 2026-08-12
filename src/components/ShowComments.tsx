'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type Reaction = { emoji: string; count: number };
type Comment = {
  id: string;
  createdAt: string;
  content: string;
  author: string;
  reactions: Reaction[];
};

const REACTION_EMOJIS = ['👍', '❤️', '🔥'];

export function ShowComments({ showId, canComment }: { showId: string; canComment: boolean }) {
  const { t } = useI18n();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shows/${showId}/comments`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { comments?: Comment[] } | null) => {
        if (!cancelled && json?.comments) setComments(json.comments);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setPosting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/shows/${showId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = (await res.json()) as { error?: string; comment?: Omit<Comment, 'reactions'> };
      if (!res.ok || !data.comment) {
        setErrorMsg(data.error ?? t('showComments.postFailedError', 'Failed to post comment.'));
      } else {
        setComments((prev) => [{ ...data.comment!, reactions: [] }, ...prev]);
        setText('');
      }
    } catch {
      setErrorMsg(t('showComments.networkError', 'Network error. Please try again.'));
    } finally {
      setPosting(false);
    }
  }

  async function toggleReaction(commentId: string, emoji: string) {
    if (!canComment) return;
    try {
      const res = await fetch(`/api/shows/${showId}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
      if (!res.ok) return;
      const data = (await res.json()) as { reactions?: Reaction[] };
      if (data.reactions) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, reactions: data.reactions! } : c))
        );
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>{t('showComments.heading', 'Comments')}</h2>

      {canComment ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <label className="form-label">
            {t('showComments.addCommentLabel', 'Add a comment')}
            <textarea
              className="input"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('showComments.commentPlaceholder', 'Say something about this show…')}
              style={{ resize: 'vertical' }}
              maxLength={1500}
            />
          </label>
          {errorMsg && <p style={{ color: 'var(--accent)' }}>{errorMsg}</p>}
          <button className="button small" type="submit" disabled={posting || !text.trim()}>
            {posting ? t('showComments.posting', 'Posting…') : t('showComments.postButton', 'Post comment')}
          </button>
        </form>
      ) : (
        <p className="meta">{t('showComments.signInPrompt', 'Sign in to join the conversation.')}</p>
      )}

      {loading ? (
        <p className="meta">{t('showComments.loading', 'Loading comments…')}</p>
      ) : comments.length === 0 ? (
        <p className="meta">{t('showComments.emptyState', 'No comments yet — be the first to say something.')}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
          {comments.map((comment) => (
            <li
              key={comment.id}
              style={{ padding: '0.75rem 0.9rem', borderRadius: '10px', background: 'var(--hair-30)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <strong>{comment.author}</strong>
                <span className="meta" style={{ fontSize: '0.75rem' }}>
                  {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {comment.content}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REACTION_EMOJIS.map((emoji) => {
                  const found = comment.reactions.find((r) => r.emoji === emoji);
                  return (
                    <button
                      key={emoji}
                      className="button small secondary"
                      type="button"
                      disabled={!canComment}
                      title={canComment ? undefined : t('showComments.signInToReactTitle', 'Sign in to react')}
                      onClick={() => void toggleReaction(comment.id, emoji)}
                      style={{ fontSize: '0.75rem', padding: '2px 10px' }}
                    >
                      {emoji} {found ? found.count : ''}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
