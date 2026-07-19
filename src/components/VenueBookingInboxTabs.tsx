'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ReceivedRequest = {
  id: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  fromUser: {
    name: string | null;
    username: string | null;
    profiles: { slug: string; type: string; genres: string[]; city: string | null }[];
  };
};

type Tab = 'pending' | 'accepted' | 'declined';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
];

/**
 * Dedicated Booking Inbox page (DESIGN_SYNC row 224) — a fuller view than the
 * pending-only BookingRequestInbox.tsx embedded on the venue profile's own
 * insights tab. Same real GET/PATCH /api/booking-requests API; this adds the
 * Accepted/Declined tabs and a "View profile" link the design template asked
 * for. No new backend — accept/decline are the same real, owner-checked
 * PATCH used everywhere else in the app.
 */
export function VenueBookingInboxTabs({ profileId }: { profileId: string }) {
  const [requests, setRequests] = useState<ReceivedRequest[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');

  useEffect(() => {
    fetch('/api/booking-requests')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRequests(data.received ?? []))
      .catch(() => setError(true));
  }, [profileId]);

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

  if (error) return <p className="vbi-empty">Couldn't load booking requests right now.</p>;
  if (!requests) return <p className="vbi-empty">Loading booking requests…</p>;

  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    declined: requests.filter((r) => r.status === 'declined').length,
  };
  const shown = requests.filter((r) => r.status === tab);

  return (
    <div>
      <div className="vbi-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`vbi-tab${tab === t.id ? ' vbi-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label} {t.id === 'pending' ? `(${counts.pending})` : ''}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="vbi-empty-card">
          <p>
            {tab === 'pending' && 'No pending requests right now.'}
            {tab === 'accepted' && 'No accepted bookings yet.'}
            {tab === 'declined' && "Nothing declined — good sign."}
          </p>
        </div>
      ) : (
        <div className="vbi-list">
          {shown.map((r) => {
            const requesterProfile = r.fromUser.profiles[0];
            return (
              <div className="vbi-card" key={r.id}>
                <div className="vbi-card-head">
                  <div>
                    <div className="vbi-name">{r.fromUser.name ?? r.fromUser.username ?? 'A user'}</div>
                    {requesterProfile && (
                      <div className="vbi-meta">
                        {[requesterProfile.genres[0], requesterProfile.city].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <span className={`vbi-pill vbi-pill-${r.status}`}>
                    {r.status === 'pending' ? 'Pending' : r.status === 'accepted' ? 'Booked' : 'Declined'}
                  </span>
                </div>
                <p className="vbi-message">{r.message}</p>
                <div className="vbi-meta" style={{ marginBottom: r.status === 'pending' ? 12 : 0 }}>
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                {r.status === 'pending' && (
                  <div className="vbi-actions">
                    <button className="vbi-btn vbi-btn-accept" disabled={busyId === r.id} onClick={() => act(r.id, 'accepted')} type="button">
                      Accept
                    </button>
                    <button className="vbi-btn vbi-btn-decline" disabled={busyId === r.id} onClick={() => act(r.id, 'declined')} type="button">
                      Decline
                    </button>
                    {requesterProfile && (
                      <Link
                        className="vbi-btn vbi-btn-outline"
                        href={requesterProfile.type === 'DJ' ? `/promoters/${requesterProfile.slug}` : `/artists/${requesterProfile.slug}`}
                      >
                        View profile
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .vbi-tabs { display: flex; gap: 4px; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 3px; margin-bottom: 20px; width: fit-content; }
        .vbi-tab { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding: 8px 16px; border-radius: var(--radius-pill); border: none; background: transparent; color: var(--ink-a60); cursor: pointer; }
        .vbi-tab-active { background: var(--role-venue, #22e5d4); color: #0a0805; }
        .vbi-empty, .vbi-empty-card { font-size: 13px; color: var(--ink-a45); margin: 0; }
        .vbi-empty-card { text-align: center; padding: 48px 24px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); }
        .vbi-list { display: flex; flex-direction: column; gap: 12px; }
        .vbi-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); padding: 18px 20px; }
        .vbi-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
        .vbi-name { font-family: var(--font-display); font-weight: 800; font-size: 15px; color: var(--ink); }
        .vbi-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .vbi-message { font-size: 13px; color: var(--ink-a75); line-height: 1.5; margin: 8px 0; }
        .vbi-pill { flex-shrink: 0; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; padding: 5px 10px; border-radius: var(--radius-pill); }
        .vbi-pill-pending { background: rgba(255,184,74,.15); color: #ffb84a; }
        .vbi-pill-accepted { background: rgba(34,229,212,.15); color: var(--role-venue, #22e5d4); }
        .vbi-pill-declined { background: var(--line); color: var(--ink-a55); }
        .vbi-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .vbi-btn { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 9px 16px; border-radius: var(--radius-pill); border: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
        .vbi-btn-accept { background: var(--role-venue, #22e5d4); color: #0a0805; }
        .vbi-btn-decline { background: transparent; color: var(--ink-a60); border: 1px solid var(--line); }
        .vbi-btn-outline { background: transparent; color: var(--ink-a70); border: 1px solid var(--line); }
        .vbi-btn:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </div>
  );
}
