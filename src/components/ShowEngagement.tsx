'use client';

import { useEffect, useState } from 'react';

type Attendee = { name: string | null; avatar: string | null };

export function ShowEngagement({
  showId,
  canRsvp,
  initialCount,
  initialGoing,
  canRemind,
  initialReminded,
  showEnded
}: {
  showId: string;
  canRsvp: boolean;
  initialCount: number;
  initialGoing: boolean;
  canRemind: boolean;
  initialReminded: boolean;
  showEnded: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [going, setGoing] = useState(initialGoing);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const [reminded, setReminded] = useState(initialReminded);
  const [remindLoading, setRemindLoading] = useState(false);

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [attendeeLoading, setAttendeeLoading] = useState(false);

  useEffect(() => {
    // Sync RSVP state
    fetch(`/api/shows/${showId}/rsvp`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        if (typeof j.count === 'number') setCount(j.count);
        if (typeof j.going === 'boolean') setGoing(j.going);
      })
      .catch(() => {});

    // Load who's going
    fetch(`/api/shows/${showId}/attendees`)
      .then((r) => r.json())
      .then((data) => {
        setAttendees(data.attendees ?? []);
        setAttendeeCount(data.count ?? 0);
      })
      .catch(() => {});
  }, [showId]);

  async function toggleRsvp() {
    if (!canRsvp || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      const res = await fetch(`/api/shows/${showId}/rsvp`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { going?: boolean; count?: number };
      if (res.ok) {
        if (typeof json.count === 'number') setCount(json.count);
        if (typeof json.going === 'boolean') setGoing(json.going);
      }
    } finally {
      setRsvpBusy(false);
    }
  }

  async function toggleRemind() {
    if (!canRemind || showEnded) return;
    setRemindLoading(true);
    try {
      const res = await fetch(`/api/shows/${showId}/remind`, { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { reminded?: boolean };
        setReminded(Boolean(data.reminded));
      }
    } catch { /* ignore */ } finally {
      setRemindLoading(false);
    }
  }

  async function toggleAttendee() {
    setAttendeeLoading(true);
    try {
      const res = await fetch(`/api/shows/${showId}/attendees`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setOptedIn(data.optedIn);
        const refresh = await fetch(`/api/shows/${showId}/attendees`);
        const refreshData = await refresh.json();
        setAttendees(refreshData.attendees ?? []);
        setAttendeeCount(refreshData.count ?? 0);
      }
    } finally {
      setAttendeeLoading(false);
    }
  }

  const visible = attendees.slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* RSVP + Remind row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={toggleRsvp}
          disabled={!canRsvp || rsvpBusy}
          className={`button small ${going ? '' : 'secondary'}`}
          aria-pressed={going}
          title={canRsvp ? 'Toggle RSVP' : 'Sign in to RSVP'}
        >
          {going ? '✓ Going' : 'Going?'} ({count})
        </button>

        {canRemind && !showEnded && (
          <button
            className={`button small ${reminded ? '' : 'secondary'}`}
            onClick={toggleRemind}
            disabled={remindLoading}
          >
            {reminded ? 'Reminder set ✓' : 'Remind me'}
          </button>
        )}
      </div>

      {/* Who's going */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>
          {visible.map((a, i) => (
            <div
              key={i}
              title={a.name ?? 'Fan'}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--accent, #ff3e9a)', border: '2px solid var(--bg, #0a0a14)',
                marginLeft: i > 0 ? -10 : 0, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}
            >
              {a.avatar ? (
                <img alt={a.name ?? 'Fan'} src={a.avatar} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (a.name?.[0] ?? '?').toUpperCase()
              )}
            </div>
          ))}
        </div>
        {attendeeCount > 0 && (
          <span className="meta">
            {attendeeCount} fan{attendeeCount !== 1 ? 's' : ''} going{attendeeCount > 8 ? ` (+${attendeeCount - 8} more)` : ''}
          </span>
        )}
        <button
          className="button small secondary"
          disabled={attendeeLoading}
          onClick={toggleAttendee}
          style={{ marginLeft: 4 }}
        >
          {optedIn === true ? "I'm going ✓" : optedIn === false ? 'Not going' : "I'm going!"}
        </button>
      </div>
    </div>
  );
}
