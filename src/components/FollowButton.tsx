'use client';

import { useEffect, useState } from 'react';

export function FollowButton({ profileId }: { profileId: string }) {
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
      className={`button small${following ? ' secondary' : ''}`}
      disabled={busy}
      onClick={toggle}
      type="button"
    >
      {following ? 'Following' : 'Follow'} · {count}
    </button>
  );
}
