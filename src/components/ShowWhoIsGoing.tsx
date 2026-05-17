'use client';

import { useEffect, useState } from 'react';

type Attendee = { name: string | null; avatar: string | null };

export function ShowWhoIsGoing({ showId }: { showId: string }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [count, setCount] = useState(0);
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/shows/${showId}/attendees`)
      .then((r) => r.json())
      .then((data) => {
        setAttendees(data.attendees ?? []);
        setCount(data.count ?? 0);
      })
      .catch(() => {});
  }, [showId]);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/shows/${showId}/attendees`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setOptedIn(data.optedIn);
        // Refresh attendee list
        const refresh = await fetch(`/api/shows/${showId}/attendees`);
        const refreshData = await refresh.json();
        setAttendees(refreshData.attendees ?? []);
        setCount(refreshData.count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  const visible = attendees.slice(0, 8);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex' }}>
        {visible.map((a, i) => (
          <div
            key={i}
            title={a.name ?? 'Fan'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--accent, #ff3e9a)',
              border: '2px solid var(--bg, #0a0a14)',
              marginLeft: i > 0 ? -10 : 0,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {a.avatar ? (
              <img alt={a.name ?? 'Fan'} src={a.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (a.name?.[0] ?? '?').toUpperCase()
            )}
          </div>
        ))}
      </div>
      {count > 0 && (
        <span className="meta">
          {count} fan{count !== 1 ? 's' : ''} going{count > 8 ? ` (+${count - 8} more)` : ''}
        </span>
      )}
      <button
        className="button small secondary"
        disabled={loading}
        onClick={toggle}
        style={{ marginLeft: 4 }}
      >
        {optedIn === true ? "I'm going ✓" : optedIn === false ? 'Not going' : "I'm going!"}
      </button>
    </div>
  );
}
