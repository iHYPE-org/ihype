'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ExistingSlot = { profileSlug: string; profileName: string; splitPercent: number; isHeadliner: boolean };

type Row = { profileSlug: string; splitPercent: string; isHeadliner: boolean };

/**
 * Venue-only lineup composer (Lineup & Split Agreement, DESIGN_SYNC row
 * 226) — proposes or revises the per-act split of a show's artist share.
 * Resolves each typed profile slug to a real profileId via the existing
 * GET /api/search endpoint (an exact-slug match is a search hit on that
 * profile's name/slug), then POSTs the real proposal to
 * POST /api/shows/[showId]/lineup. Any submit here resets every named
 * act's acceptance back to PENDING, matching that route's own contract.
 */
export function VenueLineupComposer({
  showId,
  artistPayoutPercent,
  existingSlots,
}: {
  showId: string;
  artistPayoutPercent: number;
  existingSlots: ExistingSlot[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    existingSlots.length > 0
      ? existingSlots.map((s) => ({ profileSlug: s.profileSlug, splitPercent: String(s.splitPercent), isHeadliner: s.isHeadliner }))
      : [
          { profileSlug: '', splitPercent: '', isHeadliner: true },
          { profileSlug: '', splitPercent: '', isHeadliner: false },
        ],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = rows.reduce((sum, r) => sum + (Number(r.splitPercent) || 0), 0);
  const remainder = artistPayoutPercent - total;

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function setHeadliner(i: number) {
    setRows((prev) => prev.map((r, idx) => ({ ...r, isHeadliner: idx === i })));
  }

  function addRow() {
    setRows((prev) => [...prev, { profileSlug: '', splitPercent: '', isHeadliner: false }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function resolveProfileId(slug: string): Promise<{ id: string; name: string } | null> {
    const res = await fetch(`/api/search?q=${encodeURIComponent(slug)}&type=artist&limit=10`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const match = (data?.profiles ?? []).find((p: { slug: string; type: string }) => p.slug === slug && (p.type === 'ARTIST' || p.type === 'DJ'));
    return match ? { id: match.id, name: match.name } : null;
  }

  async function submit() {
    setError(null);
    if (rows.some((r) => !r.profileSlug.trim() || !r.splitPercent.trim())) {
      setError('Every act needs a profile slug and a split percentage.');
      return;
    }
    if (remainder !== 0) {
      setError(`Splits must add up to exactly ${artistPayoutPercent}% (currently ${total}%).`);
      return;
    }
    if (rows.filter((r) => r.isHeadliner).length !== 1) {
      setError('Exactly one act must be marked as the headliner.');
      return;
    }

    setSubmitting(true);
    try {
      const resolved = await Promise.all(rows.map((r) => resolveProfileId(r.profileSlug.trim())));
      const missing = resolved.findIndex((r) => r === null);
      if (missing !== -1) {
        setError(`Couldn't find an artist/DJ profile at slug "${rows[missing].profileSlug}".`);
        setSubmitting(false);
        return;
      }

      const res = await fetch(`/api/shows/${showId}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slots: rows.map((r, i) => ({
            profileId: resolved[i]!.id,
            splitPercent: Number(r.splitPercent),
            isHeadliner: r.isHeadliner,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not save the lineup proposal.');
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="vlc">
      <div className="vlc-eyebrow">{existingSlots.length > 0 ? 'Revise lineup split' : 'Propose lineup split'}</div>
      <p className="vlc-hint">
        Every act's split percentage must add up to this show's {artistPayoutPercent}% artist share. Submitting resets everyone's acceptance — each act has to sign off again.
      </p>

      {rows.map((row, i) => (
        <div className="vlc-row" key={i}>
          <input
            className="vlc-input vlc-input-slug"
            onChange={(e) => updateRow(i, { profileSlug: e.target.value })}
            placeholder="artist or DJ profile slug"
            value={row.profileSlug}
          />
          <input
            className="vlc-input vlc-input-pct"
            inputMode="numeric"
            onChange={(e) => updateRow(i, { splitPercent: e.target.value.replace(/\D/g, '') })}
            placeholder="%"
            value={row.splitPercent}
          />
          <label className="vlc-headliner">
            <input checked={row.isHeadliner} name="headliner" onChange={() => setHeadliner(i)} type="radio" />
            Headliner
          </label>
          {rows.length > 2 && (
            <button className="vlc-remove" onClick={() => removeRow(i)} type="button">
              Remove
            </button>
          )}
        </div>
      ))}

      <div className="vlc-actions">
        <button className="vlc-btn vlc-btn-outline" onClick={addRow} type="button">
          + Add act
        </button>
        <span className={`vlc-total${remainder !== 0 ? ' vlc-total-off' : ''}`}>
          {total}% of {artistPayoutPercent}%
        </span>
      </div>

      {error && <p className="vlc-error">{error}</p>}

      <button className="vlc-btn vlc-btn-solid" disabled={submitting} onClick={submit} type="button">
        {submitting ? 'Sending…' : existingSlots.length > 0 ? 'Re-propose lineup' : 'Send lineup proposal'}
      </button>

      <style>{`
        .vlc { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 20px; margin-top: 20px; }
        .vlc-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .vlc-hint { font-size: 12px; color: var(--ink-a55); line-height: 1.6; margin: 0 0 16px; }
        .vlc-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
        .vlc-input { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 9px 12px; color: var(--ink); font-size: 13px; }
        .vlc-input-slug { flex: 1; min-width: 140px; }
        .vlc-input-pct { width: 60px; }
        .vlc-headliner { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-a60); white-space: nowrap; }
        .vlc-remove { font-size: 11px; color: var(--ink-a45); background: none; border: none; cursor: pointer; text-decoration: underline; }
        .vlc-actions { display: flex; justify-content: space-between; align-items: center; margin: 10px 0 16px; }
        .vlc-btn { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; padding: 10px 18px; border-radius: var(--radius-pill); border: none; cursor: pointer; }
        .vlc-btn-outline { background: transparent; color: var(--ink-a70); border: 1px solid var(--line); }
        .vlc-btn-solid { background: var(--accent, #ff5029); color: #fff; width: 100%; }
        .vlc-btn:disabled { opacity: 0.6; cursor: default; }
        .vlc-total { font-family: var(--font-mono); font-size: 12px; color: var(--role-venue, #22e5d4); }
        .vlc-total-off { color: var(--accent, #ff5029); }
        .vlc-error { color: var(--accent, #ff5029); font-size: 12.5px; margin: 0 0 12px; }
      `}</style>
    </div>
  );
}
