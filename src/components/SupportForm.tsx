'use client';

import { FormEvent, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { createAlphaDiagnostics } from '@/lib/alpha-diagnostics';

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
const CATEGORIES: { label: string; labelKey: string; type: string }[] = [
  { label: 'Ticket issue', labelKey: 'supportForm.categoryTicketIssue', type: 'ticketing' },
  { label: 'Payment / Payout', labelKey: 'supportForm.categoryPaymentPayout', type: 'general' },
  { label: 'Account / Login', labelKey: 'supportForm.categoryAccountLogin', type: 'login' },
  { label: 'Verification', labelKey: 'supportForm.categoryVerification', type: 'verification' },
  { label: 'Privacy / Data', labelKey: 'supportForm.categoryPrivacyData', type: 'privacy' },
  { label: 'Bug report', labelKey: 'supportForm.categoryBugReport', type: 'general' },
  { label: 'Other', labelKey: 'supportForm.categoryOther', type: 'general' },
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

export function SupportForm({ alphaModule, initialType = 'general', initialSubject = '' }: { alphaModule?: string; initialType?: string; initialSubject?: string } = {}) {
  const { t } = useI18n();
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
      setError(t('supportForm.fillAllFields', 'Please fill in all fields.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const type = CATEGORIES.find((c) => c.label === category)?.type ?? 'general';
      const diagnostic = alphaModule ? createAlphaDiagnostics(alphaModule) : null;
      const diagnosticDetails = diagnostic
        ? `${details}\n\n---\nAlpha diagnostics: module=${diagnostic.module}; viewport=${diagnostic.viewport}; platform=${diagnostic.platform}; app=${diagnostic.appVersion}; ref=${diagnostic.errorId}`
        : details;
      await postSupportRequest({ type, email, subject, details: diagnosticDetails, company });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('supportForm.couldNotSendRequest', 'Could not send request.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>{t('supportForm.messageSentTitle', 'Message sent')}</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-a65)' }}>{t('supportForm.replyWithin24h', "We'll reply to")} {email} {t('supportForm.within24h', 'within 24h.')}</p>
      </div>
    );
  }

  return (
    <form className="form support-form" onSubmit={submit}>
      <label className="field">
        <span>{t('supportForm.categoryLabel', 'Category')}</span>
        <select onChange={(event) => setCategory(event.target.value)} value={category}>
          <option value="">{t('supportForm.selectTopicPlaceholder', 'Select a topic…')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.label} value={c.label}>{t(c.labelKey, c.label)}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t('supportForm.emailLabel', 'Email')}</span>
        <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
      </label>

      <label className="field">
        <span>{t('supportForm.subjectLabel', 'Subject')}</span>
        <input onChange={(event) => setSubject(event.target.value)} placeholder={t('supportForm.subjectPlaceholder', 'Brief summary')} type="text" value={subject} />
      </label>

      <label className="field">
        <span>{t('supportForm.messageLabel', 'Message')}</span>
        <textarea
          maxLength={2500}
          onChange={(event) => setDetails(event.target.value)}
          placeholder={t('supportForm.messagePlaceholder', "Tell us what's happening…")}
          rows={7}
          value={details}
        />
      </label>

      <label className="bot-field" aria-hidden="true">
        <span>{t('supportForm.companyLabel', 'Company')}</span>
        <input
          autoComplete="off"
          onChange={(event) => setCompany(event.target.value)}
          tabIndex={-1}
          type="text"
          value={company}
        />
      </label>

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? t('supportForm.sending', 'Sending…') : t('supportForm.sendMessage', 'Send Message')}
      </button>
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </form>
  );
}
