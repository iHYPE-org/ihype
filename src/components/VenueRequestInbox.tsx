'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type VenueRequest = {
  id: string;
  artistName: string;
  note: string | null;
  requesterType: 'LISTENER' | 'PROMOTER';
  createdAt: string;
  status: string;
  artistProfile: { slug: string } | null;
};

export function VenueRequestInbox() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<VenueRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/venue-requests')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.requests)) setRequests(data.requests);
        else setError(data.error ?? t('venueRequestInbox.errorCouldNotLoad', 'Could not load requests.'));
      })
      .catch(() => {
        if (!cancelled) setError(t('venueRequestInbox.errorCouldNotLoad', 'Could not load requests.'));
      });
    return () => { cancelled = true; };
  }, []);

  async function act(id: string, status: 'BOOKED' | 'DISMISSED') {
    setBusyId(id);
    const res = await fetch(`/api/venue-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t('venueRequestInbox.errorCouldNotUpdate', 'Could not update this request.'));
    }
    setBusyId(null);
  }

  if (error) {
    return <p style={{ color: 'var(--ink-a65)' }}>{error}</p>;
  }

  if (requests === null) {
    return <p style={{ color: 'var(--ink-a65)' }}>{t('venueRequestInbox.loading', 'Loading requests…')}</p>;
  }

  if (requests.length === 0) {
    return <p style={{ color: 'var(--ink-a65)' }}>{t('venueRequestInbox.empty', 'No pending booking requests right now.')}</p>;
  }

  return (
    <div className="venue-request-inbox">
      {requests.map((r) => (
        <div className="venue-request-card" key={r.id}>
          <div className="venue-request-head">
            <div>
              <div className="venue-request-artist">{r.artistName}</div>
              <div className="venue-request-meta">
                {r.requesterType === 'PROMOTER' ? t('venueRequestInbox.suggestedByPromoter', 'Suggested by a promoter') : t('venueRequestInbox.suggestedByFan', 'Suggested by a fan')}
                {' · '}
                {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
          {r.note && <p className="venue-request-note">{r.note}</p>}
          <div className="venue-request-actions">
            <button
              className="venue-request-btn venue-request-approve"
              disabled={busyId === r.id}
              onClick={() => act(r.id, 'BOOKED')}
              type="button"
            >
              {busyId === r.id ? t('venueRequestInbox.working', 'Working…') : t('venueRequestInbox.approve', 'Approve')}
            </button>
            <button
              className="venue-request-btn venue-request-deny"
              disabled={busyId === r.id}
              onClick={() => act(r.id, 'DISMISSED')}
              type="button"
            >
              {busyId === r.id ? t('venueRequestInbox.working', 'Working…') : t('venueRequestInbox.deny', 'Deny')}
            </button>
          </div>
        </div>
      ))}

      <style>{`
        .venue-request-inbox { display: flex; flex-direction: column; gap: 16px; }
        .venue-request-card { border: 1px solid var(--line); border-radius: 10px; padding: 20px; background: var(--bg2); }
        .venue-request-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .venue-request-artist { font-family: var(--font-display); font-size: 1rem; font-weight: 800; color: var(--ink); }
        .venue-request-meta { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-a65); margin-top: 4px; }
        .venue-request-note { font-size: 0.9375rem; color: var(--ink-a70); margin-top: 12px; line-height: 1.6; white-space: pre-wrap; }
        .venue-request-actions { display: flex; gap: 10px; margin-top: 16px; }
        .venue-request-btn { padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 0.9375rem; cursor: pointer; border: none; }
        .venue-request-btn:disabled { opacity: .6; cursor: default; }
        .venue-request-approve { background: var(--role-venue); color: var(--bg); }
        .venue-request-deny { background: var(--line); color: var(--ink); border: 1px solid var(--hair-100); }
      `}</style>
    </div>
  );
}
