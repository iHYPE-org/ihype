'use client';

import { useState } from 'react';
import { postJson } from '@/lib/api-client';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  role?: string;
}

/**
 * Captures an email for the private-alpha waitlist and forwards it to
 * admin@ihype.org (POST /api/beta-access-request) — used wherever
 * registration is gated behind an invite code.
 */
export function RequestBetaAccessForm({ role }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await postJson('/api/beta-access-request', { email, role });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : t('requestBetaAccessForm.sendError', 'Could not send your request. Try again.'));
    }
  }

  if (status === 'sent') {
    return (
      <div className="beta-access-panel beta-access-sent">
        <p>{t('requestBetaAccessForm.sentMessage', "Thanks — we've got your email. We'll reach out when your invite is ready.")}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="beta-access-toggle" onClick={() => setOpen(true)}>
        {t('requestBetaAccessForm.toggleLabel', "Don't have a code? Request alpha access →")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="beta-access-panel">
      <label className="beta-access-label" htmlFor="beta-access-email">{t('requestBetaAccessForm.emailLabel', 'Your email')}</label>
      <div className="beta-access-row">
        <input
          id="beta-access-email"
          type="email"
          required
          autoComplete="email"
          placeholder={t('requestBetaAccessForm.emailPlaceholder', 'you@example.com')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? t('requestBetaAccessForm.sending', 'Sending…') : t('requestBetaAccessForm.submitLabel', 'Request access')}
        </button>
      </div>
      {error ? <p className="beta-access-error">{error}</p> : null}

      <style>{`
        .beta-access-toggle { background: none; border: none; padding: 0; color: var(--ink-2); font-family: var(--font-mono); font-size: .78rem; text-decoration: underline; cursor: pointer; }
        .beta-access-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--hair-30, rgba(255,255,255,.02)); }
        .beta-access-label { font-family: var(--font-mono); font-size: .68rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
        .beta-access-row { display: flex; gap: 8px; }
        .beta-access-row input { flex: 1; background: var(--bg); border: 1px solid var(--line-2); border-radius: 8px; padding: 10px 12px; color: var(--ink); font-family: var(--font-body); font-size: .9rem; }
        .beta-access-row button { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 10px 16px; font-family: var(--font-display); font-weight: 700; font-size: .85rem; cursor: pointer; white-space: nowrap; }
        .beta-access-row button:disabled { opacity: .6; cursor: default; }
        .beta-access-error { font-size: .78rem; color: var(--accent); margin: 0; }
        .beta-access-sent p { margin: 0; font-size: .85rem; color: var(--ink-2); }
      `}</style>
    </form>
  );
}
