'use client';

import { useEffect, useState } from 'react';

export function ShowRsvpButton({
  showId,
  canRsvp,
  initialCount,
  initialGoing
}: {
  showId: string;
  canRsvp: boolean;
  initialCount: number;
  initialGoing: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [going, setGoing] = useState(initialGoing);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Re-sync once on mount in case data is stale.
    fetch(`/api/shows/${showId}/rsvp`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        if (typeof j.count === 'number') setCount(j.count);
        if (typeof j.going === 'boolean') setGoing(j.going);
      })
      .catch(() => {});
  }, [showId]);

  async function toggle() {
    if (!canRsvp || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/shows/${showId}/rsvp`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { going?: boolean; count?: number };
      if (res.ok) {
        if (typeof json.count === 'number') setCount(json.count);
        if (typeof json.going === 'boolean') setGoing(json.going);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!canRsvp || busy}
      className={`button small ${going ? '' : 'secondary'}`}
      aria-pressed={going}
      title={canRsvp ? 'Toggle RSVP' : 'Sign in to RSVP'}
    >
      {going ? '✓ Going' : 'Going?'} ({count})
    </button>
  );
}
