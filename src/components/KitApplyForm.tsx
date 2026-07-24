'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postJson } from '@/lib/api-client';

export interface KitApplyField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'email' | 'url' | 'select';
  options?: string[];
}

interface Props {
  role: 'ARTIST' | 'DJ' | 'VENUE' | 'FAN';
  roleColor: string;
  /** Whether signup is currently gated behind an invite code (isInviteCodeRequiredRuntime()). */
  inviteOnly: boolean;
  heading: string;
  intro: string;
  /** Extra fields collected beyond email — packed into the beta-access-request's `note`. */
  fields: KitApplyField[];
  applyLabel: string;
  successIcon: string;
  successTitle: string;
  successBody: string;
  openLabel: string;
  openHref: string;
}

/**
 * Pre-signup recruiting form for the role kit pages (Artist/DJ/Venue/Fan Kit).
 * When signup is invite-gated, this is the real `/api/beta-access-request`
 * lead-capture flow (rate-limited, audit-logged, emails admin@ihype.org) —
 * the same backend `RequestBetaAccessForm` already uses on `/register`.
 * Once invite-gating lifts, the extra fields here have nowhere real to land
 * (registration only collects name/email/role), so we skip straight to a
 * real `/register?role=` link instead of capturing data that would be thrown away.
 */
export function KitApplyForm({
  role, roleColor, inviteOnly, heading, intro, fields, applyLabel,
  successIcon, successTitle, successBody, openLabel, openHref,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!inviteOnly) {
    return (
      <div className="kit-apply-card" style={{ '--role-c': roleColor } as React.CSSProperties}>
        <h2 className="kit-apply-head">{heading}</h2>
        <p className="kit-apply-intro">{intro}</p>
        <Link href={openHref} className="kit-apply-submit" style={{ display: 'inline-flex', justifyContent: 'center' }}>
          {openLabel}
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError('');
    const note = fields
      .map((f) => (values[f.key]?.trim() ? `${f.label}: ${values[f.key].trim()}` : null))
      .filter(Boolean)
      .join(' · ');
    try {
      await postJson('/api/beta-access-request', { email, role, note: note || undefined });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not send your request. Try again.');
    }
  }

  if (status === 'sent') {
    return (
      <div className="kit-apply-card kit-apply-sent" style={{ '--role-c': roleColor } as React.CSSProperties}>
        <div className="kit-apply-sent-icon">{successIcon}</div>
        <div className="kit-apply-sent-title">{successTitle}</div>
        <p className="kit-apply-sent-body">{successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="kit-apply-card" style={{ '--role-c': roleColor } as React.CSSProperties}>
      <h2 className="kit-apply-head">{heading}</h2>
      <p className="kit-apply-intro">{intro}</p>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="kit-apply-input"
      />
      {fields.map((f) =>
        f.type === 'select' ? (
          <select
            key={f.key}
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="kit-apply-input kit-apply-select"
          >
            <option value="" disabled>{f.placeholder}</option>
            {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            key={f.key}
            type={f.type ?? 'text'}
            placeholder={f.placeholder}
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="kit-apply-input"
          />
        )
      )}
      <button type="submit" disabled={status === 'sending'} className="kit-apply-submit">
        {status === 'sending' ? 'Sending…' : applyLabel}
      </button>
      {error ? <p className="kit-apply-error">{error}</p> : null}
      <p className="kit-apply-note">No spam. We review every application personally.</p>

      <style>{`
        .kit-apply-card {
          background: linear-gradient(160deg, color-mix(in srgb, var(--role-c) 14%, #0a0805), #0a0805);
          border: 1px solid color-mix(in srgb, var(--role-c) 25%, transparent);
          border-radius: 22px;
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .kit-apply-head { font-family: var(--font-display); font-weight: 800; font-size: 1.3rem; letter-spacing: -.02em; color: var(--text); margin: 0; }
        .kit-apply-intro { font-size: .92rem; color: var(--muted); line-height: 1.6; margin: 0 0 8px; }
        .kit-apply-input {
          width: 100%; padding: 13px 16px; border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--role-c) 30%, transparent);
          background: color-mix(in srgb, var(--role-c) 6%, transparent);
          color: var(--text); font-family: var(--font-body); font-size: .95rem; outline: none;
        }
        .kit-apply-select { color: var(--muted); cursor: pointer; appearance: none; }
        .kit-apply-submit {
          width: 100%; padding: 14px; border-radius: 12px; border: none; margin-top: 4px;
          background: var(--role-c); color: #0a0805; font-family: var(--font-display);
          font-weight: 800; font-size: 1rem; cursor: pointer; text-decoration: none;
          text-align: center;
        }
        .kit-apply-submit:disabled { opacity: .7; cursor: default; }
        .kit-apply-note { font-family: var(--font-mono); font-size: .68rem; color: var(--ink-3); text-align: center; letter-spacing: .04em; margin: 4px 0 0; }
        .kit-apply-error { font-size: .8rem; color: var(--role-c); margin: 0; }
        .kit-apply-sent { align-items: center; text-align: center; padding: 40px 28px; }
        .kit-apply-sent-icon { font-size: 2.6rem; }
        .kit-apply-sent-title { font-family: var(--font-display); font-weight: 800; font-size: 1.3rem; }
        .kit-apply-sent-body { font-size: .92rem; color: var(--muted); line-height: 1.6; margin: 0; }
      `}</style>
    </form>
  );
}
