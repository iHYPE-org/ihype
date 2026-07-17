'use client';

import { FormEvent, useState } from 'react';

async function postBugReport(body: unknown) {
  const response = await fetch('/api/bug-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not send report.');
  }

  return payload;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--line)', borderRadius: 10, padding: '18px 20px',
  background: 'var(--bg-2, #100d09)', cursor: 'pointer',
};

export function BugReportPanel() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function close() {
    setOpen(false);
    // Reset a beat after the close animation/removal so the panel doesn't
    // visibly flash back to its empty state before it unmounts.
    setTimeout(() => {
      setDescription('');
      setError('');
      setSent(false);
    }, 200);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Please describe what happened.');
      return;
    }

    setIsSubmitting(true);
    try {
      await postBugReport({
        description,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send report.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
        role="button"
        style={cardStyle}
        tabIndex={0}
      >
        <div aria-hidden="true" style={{ fontSize: 24, marginBottom: 8 }}>🐛</div>
        <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 4 }}>Report a Bug</div>
        <div style={{ fontSize: 12, color: 'var(--ink-a55)' }}>Something broken? Tell us what happened</div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="ihype-sheet-overlay"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="ihype-sheet-panel" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>Report a bug</h2>
              <button onClick={close} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--ink-a50)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {sent ? (
              <div style={{ fontSize: 13, color: '#22e5d4', padding: '10px 14px', background: 'rgba(34,229,212,.08)', borderRadius: 8 }}>
                ✓ Thanks — we logged it and will take a look.
              </div>
            ) : (
              <form className="form" onSubmit={submit}>
                <p style={{ fontSize: 13, color: 'var(--ink-a55)', margin: '0 0 6px' }}>
                  What happened? We&apos;ll attach the current page and viewport automatically.
                </p>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    maxLength={2500}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What were you doing when it broke?"
                    rows={6}
                    value={description}
                  />
                </label>
                <button className="button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Sending…' : 'Send Report'}
                </button>
                {error ? <p className="status-note status-note-error">{error}</p> : null}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
