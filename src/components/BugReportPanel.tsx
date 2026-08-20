'use client';

import { FormEvent, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { createAlphaDiagnostics } from '@/lib/alpha-diagnostics';

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
  background: 'var(--bg-2)', cursor: 'pointer',
};

export function BugReportPanel() {
  const { t } = useI18n();
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
      setError(t('bugReportPanel.descriptionRequired', 'Please describe what happened.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await postBugReport({
        description,
        diagnostics: createAlphaDiagnostics(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bugReportPanel.sendError', 'Could not send report.'));
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
        <div style={{ fontSize: '0.9375rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 4 }}>{t('bugReportPanel.cardTitle', 'Report a Bug')}</div>
        <div style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)' }}>{t('bugReportPanel.cardSubtitle', 'Something broken? Tell us what happened')}</div>
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
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>{t('bugReportPanel.dialogTitle', 'Report a bug')}</h2>
              <button onClick={close} aria-label={t('bugReportPanel.closeAriaLabel', 'Close')} style={{ background: 'none', border: 'none', color: 'var(--ink-a65)', fontSize: '1.375rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {sent ? (
              <div style={{ fontSize: '0.9375rem', color: 'var(--role-venue)', padding: '10px 14px', background: 'rgba(var(--role-venue-rgb),.08)', borderRadius: 8 }}>
                ✓ {t('bugReportPanel.sentConfirmation', 'Thanks — we logged it and will take a look.')}
              </div>
            ) : (
              <form className="form" onSubmit={submit}>
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '0 0 6px' }}>
                  {t('bugReportPanel.dialogBody', "What happened? We'll attach only the app version, module, and coarse device category.")}
                </p>
                <label className="field">
                  <span>{t('bugReportPanel.descriptionLabel', 'Description')}</span>
                  <textarea
                    maxLength={2500}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t('bugReportPanel.descriptionPlaceholder', 'What were you doing when it broke?')}
                    rows={6}
                    value={description}
                  />
                </label>
                <button className="button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? t('bugReportPanel.sending', 'Sending…') : t('bugReportPanel.sendReport', 'Send Report')}
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
