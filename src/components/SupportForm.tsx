'use client';

import { FormEvent, useState } from 'react';

async function postSupportRequest(body: unknown) {
  const response = await fetch('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not send request.');
  }

  return payload;
}

// Design's category labels, mapped to the backend's fixed `type` enum
// (src/app/api/support/route.ts) since there's no per-category schema change here.
const CATEGORIES: { label: string; type: string }[] = [
  { label: 'Ticket issue', type: 'ticketing' },
  { label: 'Payment / Payout', type: 'general' },
  { label: 'Account / Login', type: 'login' },
  { label: 'Verification', type: 'verification' },
  { label: 'Privacy / Data', type: 'privacy' },
  { label: 'Bug report', type: 'general' },
  { label: 'Other', type: 'general' },
];

const CATEGORY_FOR_TYPE: Record<string, string> = {
  privacy: 'Privacy / Data',
  login: 'Account / Login',
  verification: 'Verification',
  ticketing: 'Ticket issue',
  general: 'Other',
  copyright: 'Other',
  safety: 'Other',
};

export function SupportForm({ initialType = 'general', initialSubject = '' }: { initialType?: string; initialSubject?: string } = {}) {
  const [category, setCategory] = useState(CATEGORY_FOR_TYPE[initialType] ?? '');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [details, setDetails] = useState('');
  const [company, setCompany] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email || !subject || !details) {
      setError('Please fill in all fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const type = CATEGORIES.find((c) => c.label === category)?.type ?? 'general';
      await postSupportRequest({ type, email, subject, details, company });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Message sent</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-a65)' }}>We&apos;ll reply to {email} within 24h.</p>
      </div>
    );
  }

  return (
    <form className="form support-form" onSubmit={submit}>
      <label className="field">
        <span>Category</span>
        <select onChange={(event) => setCategory(event.target.value)} value={category}>
          <option value="">Select a topic…</option>
          {CATEGORIES.map((c) => (
            <option key={c.label} value={c.label}>{c.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Email</span>
        <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
      </label>

      <label className="field">
        <span>Subject</span>
        <input onChange={(event) => setSubject(event.target.value)} placeholder="Brief summary" type="text" value={subject} />
      </label>

      <label className="field">
        <span>Message</span>
        <textarea
          maxLength={2500}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Tell us what's happening…"
          rows={7}
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

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Sending…' : 'Send Message'}
      </button>
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </form>
  );
}
