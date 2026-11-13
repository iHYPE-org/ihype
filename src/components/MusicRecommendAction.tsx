'use client';

import { useState } from 'react';

/**
 * Listener endorsement on a published release. Track hypes feed the existing
 * Seed recommendation engine; album recommendations use the account's saved
 * album likes until a dedicated album-hype ledger is introduced.
 * Sharing is opt-in: no contacts or notifications are sent automatically.
 */
export function MusicRecommendAction({
  kind,
  id,
  title,
  sharePath,
}: {
  kind: 'track' | 'album';
  id: string;
  title: string;
  sharePath: string;
}) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  async function endorse() {
    if (pending || done) return;
    setPending(true);
    setMessage('');
    try {
      const response = kind === 'track'
        ? await fetch(`/api/discover/seeds/${encodeURIComponent(id)}/hype`, { method: 'POST' })
        : await fetch('/api/likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType: 'ALBUM', targetId: id }),
          });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Could not save your recommendation.');
      }
      setDone(true);
      setMessage(kind === 'track' ? 'Hyped! This helps other listeners discover music.' : 'Album added to your recommendations.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your recommendation.');
    } finally {
      setPending(false);
    }
  }
  async function share() {
    const url = new URL(sharePath, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url, text: `I think you might like ${title} on iHYPE.` });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMessage('Link copied. Share it with someone who might like this.');
      } else {
        setMessage(url);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setMessage('Could not share this link.');
    }
  }
  return (
    <span className="music-recommend-action" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="button small secondary" onClick={endorse} disabled={pending || done}
        aria-label={kind === 'track' ? `Hype ${title}` : `Recommend album ${title}`}>
        {pending ? 'Saving…' : done ? '✓ Recommended' : kind === 'track' ? 'Hype track' : 'Recommend album'}
      </button>
      <button type="button" className="button small secondary" onClick={share} aria-label={`Suggest ${title} to a friend`}>
        Suggest to a friend
      </button>
      {message && <span className="meta" role="status">{message}</span>}
    </span>
  );
}
