'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/components/I18nProvider';

async function postSupportRequest(body: unknown, fallbackError: string) {
  const response = await fetch('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : fallbackError);
  }

  return payload;
}

/**
 * Inline "New ticket" composer for /support/tickets — closes the gap versus
 * templates/support-tickets/SupportTickets.dc.html, which shows a header
 * button toggling a Subject/Description card in place, rather than sending
 * the user back to /support's separate category/email SupportForm.
 *
 * Posts to the same real `POST /api/support` endpoint SupportForm.tsx uses.
 * The signed-in user's name/email are filled server-side from their session
 * (src/app/api/support/route.ts), so this composer only needs to collect
 * subject + details, matching the design's two-field card. On success it
 * calls router.refresh() so the server-rendered ticket list (the real
 * requesterUserId-scoped SupportRequest query in page.tsx) re-fetches and
 * shows the new ticket at the top — the real-data equivalent of the design's
 * client-only "prepend to list" behavior.
 */
export function SupportTicketComposer() {
  const { t } = useI18n();
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = subject.trim().length > 0 && !submitting;

  function cancelNew() {
    setComposing(false);
    setSubject('');
    setDetails('');
    setError('');
  }

  async function submitNew(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim()) return;

    setSubmitting(true);
    setError('');
    const fallbackError = t('supportTicketComposer.sendErrorFallback', 'Could not send request.');
    try {
      await postSupportRequest({
        type: 'general',
        subject: subject.trim(),
        details: details.trim() || 'No additional details provided.',
      }, fallbackError);
      setComposing(false);
      setSubject('');
      setDetails('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: composing ? 16 : 0 }}>
        <button
          type="button"
          onClick={() => setComposing((c) => !c)}
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
            padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none',
            background: 'var(--accent)', color: 'var(--ink-on-accent)',
          }}
        >
          {composing ? t('supportTicketComposer.closeButton', 'Close') : t('supportTicketComposer.newTicketButton', 'New ticket')}
        </button>
      </div>

      {composing ? (
        <form
          onSubmit={submitNew}
          style={{
            border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)',
            padding: 20, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink)' }}>
            {t('supportTicketComposer.formTitle', 'New ticket')}
          </div>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t('supportTicketComposer.subjectPlaceholder', 'Subject')}
            style={{
              width: '100%', height: 42, background: 'var(--bg)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)', padding: '0 14px', color: 'var(--ink)', fontSize: '0.875rem',
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={4}
            placeholder={t('supportTicketComposer.detailsPlaceholder', 'Describe your issue')}
            style={{
              width: '100%', background: 'var(--bg)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--ink)', fontSize: '0.875rem',
              boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          {error ? <p style={{ fontSize: '0.7813rem', color: 'var(--accent)', margin: 0 }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={cancelNew}
              style={{
                padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)',
                background: 'transparent', color: 'var(--ink)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('supportTicketComposer.cancelButton', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: canSubmit ? 'var(--accent)' : 'rgba(var(--accent-rgb),.3)',
                // The disabled branch stays below the --ink-a65 text floor on
                // purpose, and is the only site that does. WCAG 1.4.3 exempts
                // disabled controls, and "cannot be read" is precisely what a
                // disabled control is meant to signal — raising it to the floor
                // would make this button look submittable when it is not.
                color: canSubmit ? 'var(--ink-on-accent)' : 'var(--ink-a50)', fontSize: '0.8125rem', fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? t('supportTicketComposer.submittingButton', 'Submitting…') : t('supportTicketComposer.submitButton', 'Submit')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
