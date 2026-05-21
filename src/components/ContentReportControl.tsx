'use client';

import { FormEvent, useState } from 'react';
import { useAsyncForm } from '@/hooks/useAsyncForm';

type ContentReportControlProps = {
  targetType: 'profile' | 'show' | 'media' | 'ticket';
  targetId: string;
  label?: string;
};

async function submitReport(body: unknown) {
  const response = await fetch('/api/content-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not submit report.');
  }

  return payload;
}

export function ContentReportControl({
  targetType,
  targetId,
  label = 'Report content'
}: ContentReportControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('Content concern');
  const [details, setDetails] = useState('');
  const [company, setCompany] = useState('');
  const { message: status, setMessage: setStatus, error, setError, pending: isSubmitting, setPending: setIsSubmitting, reset } = useAsyncForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reset();
    setIsSubmitting(true);

    try {
      await submitReport({
        targetType,
        targetId,
        reason,
        details,
        company
      });
      setStatus('Thanks. The iHYPE team will review this report.');
      setDetails('');
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="content-report-control">
      <button className="content-report-toggle" onClick={() => setIsOpen((value) => !value)} type="button">
        {label}
      </button>

      {isOpen ? (
        <form className="content-report-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Reason</span>
            <select onChange={(event) => setReason(event.target.value)} value={reason}>
              <option>Content concern</option>
              <option>Rights or copyright concern</option>
              <option>Unsafe or abusive content</option>
              <option>Wrong profile or event information</option>
            </select>
          </label>
          <label className="field">
            <span>Details</span>
            <textarea
              maxLength={1200}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Add a short note for the review team."
              rows={3}
              value={details}
            />
          </label>
          <label className="bot-field" aria-hidden="true">
            <span>Company</span>
            <input
              autoComplete="off"
              onChange={(event) => setCompany(event.target.value)}
              tabIndex={-1}
              type="text"
              value={company}
            />
          </label>
          <div className="content-report-actions">
            <button className="button small secondary" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Sending...' : 'Send report'}
            </button>
            <button className="text-link" onClick={() => setIsOpen(false)} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {status ? <p className="status-note">{status}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </div>
  );
}
