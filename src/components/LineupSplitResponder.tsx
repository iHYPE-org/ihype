'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The artist-facing Accept/Decline action for their own pending lineup
 * slot (Lineup & Split Agreement, DESIGN_SYNC row 226). A real PATCH to
 * /api/shows/[showId]/lineup/respond — accepting the last pending slot on
 * a show locks the booking server-side (DRAFT -> SCHEDULED), so this just
 * reflects whatever the API actually did rather than assuming success.
 */
export function LineupSplitResponder({ showId, splitPercent }: { showId: string; splitPercent: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: 'ACCEPTED' | 'DECLINED') {
    setBusy(status === 'ACCEPTED' ? 'accept' : 'decline');
    setError(null);
    try {
      const res = await fetch(`/api/shows/${showId}/lineup/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong — try again.');
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — try again.');
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="lsr-actions">
        <button className="lsr-btn lsr-btn-accept" disabled={busy !== null} onClick={() => respond('ACCEPTED')} type="button">
          {busy === 'accept' ? 'Accepting…' : `Accept my ${splitPercent}%`}
        </button>
        <button className="lsr-btn lsr-btn-decline" disabled={busy !== null} onClick={() => respond('DECLINED')} type="button">
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
      {error && <p className="lsr-error">{error}</p>}

      <style>{`
        .lsr-actions { display: flex; gap: 10px; }
        .lsr-btn { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; padding: 11px 20px; border-radius: var(--radius-pill); border: none; cursor: pointer; }
        .lsr-btn-accept { background: var(--accent, #ff5029); color: #fff; }
        .lsr-btn-decline { background: transparent; color: var(--ink-a60); border: 1px solid var(--line); }
        .lsr-btn:disabled { opacity: 0.6; cursor: default; }
        .lsr-error { color: var(--accent, #ff5029); font-size: 12.5px; margin: 10px 0 0; }
      `}</style>
    </div>
  );
}
