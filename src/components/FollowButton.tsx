'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

/**
 * Follow / unfollow one profile, with the optimistic count.
 *
 * Two variants, both painted by `.follow-btn` in globals.css (2026-09-02):
 * `chip` sits in a row of equal actions (the profile card's Hype · Follow ·
 * Like), `hero` matches the `*-hero-btn` links the legacy profile heroes draw
 * beside it. State is an attribute (`data-following`) so the stylesheet, and
 * therefore every theme, decides the paint — this component used to carry ~20
 * inline style properties, which is why it rendered as a bare 634px-wide label
 * next to the Hype button until the card overrode it.
 */
export function FollowButton({ profileId, variant = 'chip' }: { profileId: string; variant?: 'chip' | 'hero' }) {
  const { t } = useI18n();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/follow?profileId=${profileId}`)
      .then((r) => r.json())
      .then((d: { count: number; following: boolean }) => {
        setCount(d.count ?? 0);
        setFollowing(d.following ?? false);
      })
      .catch(() => null);
  }, [profileId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    // optimistic
    const prev = { following, count };
    setFollowing(!following);
    setCount(following ? count - 1 : count + 1);
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
      if (!res.ok) {
        setFollowing(prev.following);
        setCount(prev.count);
      } else {
        const d = (await res.json()) as { following: boolean; count: number };
        setFollowing(d.following);
        setCount(d.count);
      }
    } catch {
      setFollowing(prev.following);
      setCount(prev.count);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      disabled={busy}
      onClick={toggle}
      type="button"
      aria-pressed={following}
      aria-label={following ? t('followButton.unfollow', 'Unfollow') : t('followButton.follow', 'Follow')}
      className="follow-btn"
      data-variant={variant}
      data-following={following ? 'true' : undefined}
    >
      {following ? t('followButton.followingLabel', '✓ Following') : t('followButton.followLabel', '+ Follow')}{count > 0 ? ` · ${count}` : ''}
    </button>
  );
}
