'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The heart, for things that are not tracks — artists, venues, albums, ads.
 *
 * One like per account per thing, held until unliked (owner, 2026-08-24).
 * The rules live server-side in `/api/likes` (the schema's unique constraint
 * is the "only once"); this control's whole job is to read the stored state
 * on arrival and toggle it optimistically. Track hearts stay on
 * `/api/fan-favorites` — see the note in the API route.
 *
 * Distinct from HYPE on purpose: HYPE spends from a balance and moves the
 * chart; a like just remembers. SHELL_LOCK's two-acts rule, same as the
 * full player's heart.
 */
export type LikeTargetType = 'ALBUM' | 'ARTIST' | 'VENUE' | 'ADVERTISEMENT';

export function MmmLikeButton({
  name,
  targetId,
  targetType,
}: {
  /** What the reader hears: "Like State Theatre" / "Unlike State Theatre". */
  name: string;
  targetId: string;
  targetType: LikeTargetType;
}) {
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let stale = false;
    setLiked(false);
    void fetch(`/api/likes?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!stale && data) setLiked(Boolean(data.liked)); })
      .catch(() => { /* the heart just stays unlit */ });
    return () => { stale = true; };
  }, [targetId, targetType]);

  const toggle = useCallback(async () => {
    if (pending) return;
    const previous = liked;
    setPending(true);
    setLiked(!previous); // Optimistic: a heart that lags reads as a dropped tap.
    try {
      const response = await fetch('/api/likes', {
        method: previous ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (!response.ok) setLiked(previous);
    } catch {
      setLiked(previous);
    } finally {
      setPending(false);
    }
  }, [liked, pending, targetId, targetType]);

  return (
    <button
      aria-label={liked ? `Unlike ${name}` : `Like ${name}`}
      aria-pressed={liked}
      className="mmm-like"
      data-active={liked || undefined}
      onClick={() => void toggle()}
      type="button"
    >
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
    </button>
  );
}
