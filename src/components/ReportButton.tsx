'use client';

import { useEffect, useId, useState } from 'react';

type ReportTargetType = 'profile' | 'show' | 'media' | 'ticket';

type ReportButtonProps = {
  targetType: ReportTargetType;
  targetId: string;
  /** What's being reported, for copy only — e.g. "show", "profile". Defaults to targetType. */
  entityLabel?: string;
  /** Adopt a page's existing hero-action button class instead of the default ghost icon style. */
  className?: string;
};

const REASONS = [
  'Spam or scam',
  'Harassment or abuse',
  'Impersonation',
  'Copyright / IP violation',
  'Inappropriate content',
  'Other',
];

/**
 * Subtle flag-icon report control. Opens a minimal confirm/reason dialog and
 * POSTs to /api/content-reports (src/app/api/content-reports/route.ts) —
 * targetType must be one of that route's allowed values: 'profile' | 'show' | 'media' | 'ticket'.
 */
export function ReportButton({ targetType, targetId, entityLabel, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const titleId = useId();
  const noun = entityLabel ?? targetType;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function reset() {
    setReason('');
    setDetails('');
    setCompany('');
    setStatus('idle');
    setError('');
  }

  function close() {
    setOpen(false);
    // Small delay avoids a visible content flash while the dialog fades/unmounts.
    window.setTimeout(reset, 200);
  }

  async function submit() {
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    setStatus('submitting');
    setError('');
    try {
      const response = await fetch('/api/content-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, details: details || undefined, company: company || undefined }),
      });
      const data = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        setStatus('error');
        setError((data.error as string | undefined) ?? 'Could not submit report.');
        return;
      }
      setStatus('done');
    } catch {
      setStatus('error');
      setError('Could not submit report (network error).');
    }
  }

  return (
    <>
      <button
        aria-label={`Report this ${noun}`}
        className={className}
        onClick={() => setOpen(true)}
        title={`Report this ${noun}`}
        type="button"
        style={
          className
            ? undefined
            : {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                borderRadius: 20,
                border: '1px solid var(--hair-100)',
                background: 'var(--hair-40)',
                color: 'var(--ink-a50)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }
        }
      >
        <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="13">
          <path d="M4 3v18" />
          <path d="M4 4h13l-2.5 4L17 12H4" />
        </svg>
        {className ? 'Report' : null}
      </button>

      {open && (
        <div
          aria-hidden="true"
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 949, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 20 }}
        >
          <div
            aria-labelledby={titleId}
            aria-modal="true"
            className="card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            style={{ width: 'min(420px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            {status === 'done' ? (
              <>
                <h2 id={titleId} style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginTop: 0 }}>Report received</h2>
                <p className="meta">Thanks — our team will review this {noun}.</p>
                <button className="button small secondary" onClick={close} type="button">Close</button>
              </>
            ) : (
              <>
                <h2 id={titleId} style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginTop: 0 }}>Report this {noun}</h2>
                <p className="meta" style={{ marginBottom: 16 }}>Tell us what&apos;s wrong. Reports go to our moderation team.</p>

                <form className="form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
                  <label className="field">
                    <span>Reason</span>
                    <select onChange={(event) => setReason(event.target.value)} value={reason}>
                      <option value="">Select a reason…</option>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>Details (optional)</span>
                    <textarea
                      maxLength={1200}
                      onChange={(event) => setDetails(event.target.value)}
                      placeholder="Anything that helps our review…"
                      rows={4}
                      value={details}
                    />
                  </label>

                  <label className="bot-field" aria-hidden="true">
                    <span>Company</span>
                    <input autoComplete="off" onChange={(event) => setCompany(event.target.value)} tabIndex={-1} type="text" value={company} />
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="button small" disabled={status === 'submitting'} type="submit">
                      {status === 'submitting' ? 'Submitting…' : 'Submit report'}
                    </button>
                    <button className="button small secondary" onClick={close} type="button">Cancel</button>
                  </div>
                  {error ? <p className="status-note status-note-error">{error}</p> : null}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
