'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

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

  // 'hero' matches the *-hero-btn CSS class every profile hero row already
  // uses for its Link buttons (Customize/Settings/etc.) — same padding,
  // radius, and font-size so Follow doesn't wrap or mis-size next to them.
  const heroStyle = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 7,
    padding: '10px 18px',
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  };
  const chipStyle = {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 7,
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '.06em',
    // The label is "+ Follow" or "✓ Following · 128". Left to wrap it makes
    // the chip two lines tall and knocks the row it sits in out of
    // alignment; clipping one glyph is the better failure.
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  };

  return (
    <button
      disabled={busy}
      onClick={toggle}
      type="button"
      aria-pressed={following}
      aria-label={following ? t('followButton.unfollow', 'Unfollow') : t('followButton.follow', 'Follow')}
      style={{
        ...(variant === 'hero' ? heroStyle : chipStyle),
        border: following ? '1px solid rgba(var(--accent-rgb),.4)' : variant === 'hero' ? '1px solid var(--hair-100)' : '1px solid var(--hair-120)',
        background: following ? 'rgba(var(--accent-rgb),.1)' : variant === 'hero' ? 'var(--line)' : 'var(--hair-50)',
        color: following ? 'var(--accent)' : variant === 'hero' ? 'var(--ink)' : 'var(--ink-a65)',
        cursor: busy ? 'default' : 'pointer',
        transition: 'all 150ms ease',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {following ? t('followButton.followingLabel', '✓ Following') : t('followButton.followLabel', '+ Follow')}{count > 0 ? ` · ${count}` : ''}
    </button>
  );
}
