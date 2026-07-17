'use client';

import { useEffect, useState } from 'react';

type ReceivedRequest = {
  id: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  fromUser: { name: string | null; username: string | null };
  toProfile: { name: string; type: string };
};

const rowStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: '14px 0', borderBottom: '1px solid var(--line)',
};

const btnBase: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
  borderRadius: 9999, padding: '7px 14px', border: 'none', cursor: 'pointer',
};

/**
 * Owner-only booking-request inbox: lists pending requests sent TO this profile
 * (from GET /api/booking-requests) with accept/decline actions (PATCH). Sits
 * alongside ProfileInsights in the "insights" tab on artist/DJ/venue profile
 * pages — BookingRequest.toProfileId is not restricted to any one profile type.
 */
export function BookingRequestInbox({ profileId }: { profileId: string }) {
  const [requests, setRequests] = useState<ReceivedRequest[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch('/api/booking-requests')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRequests(data.received ?? []))
      .catch(() => setError(true));
  }

  useEffect(() => { load(); }, [profileId]);

  async function act(id: string, status: 'accepted' | 'declined') {
    setBusyId(id);
    try {
      const res = await fetch('/api/booking-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setRequests((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? prev);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (error) return null;
  if (!requests) {
    return <p style={{ fontSize: 13, color: 'var(--ink-a45)', margin: 0 }}>Loading booking requests…</p>;
  }

  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginBottom: 12 }}>
        Booking requests — inbox
      </div>
      {pending.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-a45)', margin: 0 }}>No pending booking requests right now.</p>
      ) : (
        <div>
          {pending.map((r) => (
            <div key={r.id} style={rowStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {r.fromUser.name ?? r.fromUser.username ?? 'A user'}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-a45)', whiteSpace: 'nowrap' }}>
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-a65)', margin: 0, lineHeight: 1.5 }}>{r.message}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => act(r.id, 'accepted')}
                  style={{ ...btnBase, background: '#22e5d4', color: '#0a0805', opacity: busyId === r.id ? 0.6 : 1 }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => act(r.id, 'declined')}
                  style={{ ...btnBase, background: 'transparent', color: 'var(--ink-a55)', border: '1px solid var(--line)', opacity: busyId === r.id ? 0.6 : 1 }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
