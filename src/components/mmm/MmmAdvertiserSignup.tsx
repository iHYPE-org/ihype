'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Turns an existing member into an advertiser.
 *
 * The form ME's "Add advertiser profile" button always implied and never had:
 * that button pointed at the campaign builder, and the only route that could
 * create an advertiser (`/api/advertise/register`) refuses an email that
 * already has an account — so a member could reach a campaign form without ever
 * being able to hold the profile the dashboard reads.
 *
 * Deliberately fewer fields than `/advertise/register`: it collects an email
 * and mints a whole user, and neither applies here — the session already says
 * who this is.
 */

const CATEGORIES = [
  { value: 'LABEL', label: 'Label' },
  { value: 'VENUE_PROMOTER', label: 'Venue or promoter' },
  { value: 'GEAR', label: 'Gear' },
  { value: 'TICKETING', label: 'Ticketing' },
  { value: 'MERCH', label: 'Merch' },
  { value: 'TOUR', label: 'Touring' },
] as const;

export function MmmAdvertiserSignup() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState<string>('');
  const [pitch, setPitch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/me/advertiser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactName: contactName.trim() || undefined,
          website: website.trim() || undefined,
          category: category || undefined,
          pitch: pitch.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        /* The server's own sentence where it sent one — "already has an
           advertiser profile" and "temporarily paused" are both things a member
           can act on, and a generic failure would hide them. */
        setError(payload.error ?? 'That could not be saved right now.');
        return;
      }
      /* A hard navigation, not router.push: the dashboard is a server component
         reading the row this request just created, and soft navigation from an
         /app detail route does not reliably commit (DESIGN_SYNC row 309). */
      window.location.assign('/app/me/advertising');
      router.refresh();
    } catch {
      setError('That could not be saved right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adv-signup" onSubmit={submit}>
      <label className="adv-field">
        <span className="adv-label">Company or brand name</span>
        <input
          autoComplete="organization"
          className="adv-input"
          maxLength={120}
          onChange={(event) => setCompanyName(event.target.value)}
          required
          value={companyName}
        />
      </label>
      <label className="adv-field">
        <span className="adv-label">Contact name <span className="adv-optional">optional</span></span>
        <input
          autoComplete="name"
          className="adv-input"
          maxLength={120}
          onChange={(event) => setContactName(event.target.value)}
          value={contactName}
        />
      </label>
      <label className="adv-field">
        <span className="adv-label">Website <span className="adv-optional">optional</span></span>
        <input
          autoComplete="url"
          className="adv-input"
          inputMode="url"
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="https://"
          value={website}
        />
      </label>
      <label className="adv-field">
        <span className="adv-label">Category <span className="adv-optional">optional</span></span>
        <select className="adv-input" onChange={(event) => setCategory(event.target.value)} value={category}>
          <option value="">Not sure yet</option>
          {CATEGORIES.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </select>
      </label>
      <label className="adv-field">
        <span className="adv-label">What you want to reach listeners with <span className="adv-optional">optional</span></span>
        <textarea
          className="adv-input adv-textarea"
          maxLength={1000}
          onChange={(event) => setPitch(event.target.value)}
          rows={4}
          value={pitch}
        />
      </label>

      {error && <p className="adv-error" role="status">{error}</p>}

      <div className="adv-actions">
        <button className="mmm-btn-primary" disabled={busy || companyName.trim().length < 2} type="submit">
          {busy ? 'Creating…' : 'Create advertiser profile'}
        </button>
      </div>

      <style>{`
        .adv-signup { display: flex; flex-direction: column; gap: 14px; max-width: 46ch; }
        .adv-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .adv-label { font-size: 0.9375rem; font-weight: 500; color: var(--ink); }
        .adv-optional { font-family: var(--font-mono); font-size: 0.78125rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); }
        .adv-input {
          min-height: 44px; padding: 10px 14px; box-sizing: border-box;
          border: 1px solid rgba(var(--surface-tint-rgb), .18); border-radius: 9px;
          background: var(--bg); color: var(--ink);
          font-family: var(--font-body); font-size: 1rem; width: 100%;
        }
        .adv-input:focus { outline: none; border-color: var(--accent); }
        .adv-textarea { resize: vertical; line-height: 1.5; }
        .adv-error { margin: 0; font-size: 0.9375rem; color: var(--danger-text); }
        .adv-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
      `}</style>
    </form>
  );
}
