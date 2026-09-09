'use client';

import { useState } from 'react';
import { postJson } from '@/lib/api-client';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  role?: string;
  /**
   * Render the field immediately instead of behind the "Don't have a code?"
   * disclosure. On `/register` the toggle is right — the form is a fallback for
   * someone who arrived without a code. On the landing page it is the PRIMARY
   * action, and a primary action hidden behind a disclosure is not one.
   */
  defaultOpen?: boolean;
}

/**
 * Captures an email for the private-alpha waitlist and forwards it to
 * admin@ihype.org (POST /api/beta-access-request) — used wherever
 * registration is gated behind an invite code, and on `/` for as long as
 * access is by request rather than open signup.
 */
export function RequestBetaAccessForm({ role, defaultOpen = false }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
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
        .beta-access-toggle { background: none; border: none; padding: 0; color: var(--ink-2); font-family: var(--font-mono); font-size: 0.9375rem; text-decoration: underline; cursor: pointer; }
        .beta-access-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--hair-30); }
        .beta-access-label { font-family: var(--font-mono); font-size: 0.9375rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
        .beta-access-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .beta-access-row input { flex: 1 1 14rem; min-width: min(14rem, 100%); min-height: 44px; background: var(--bg); border: 1px solid var(--line-2); border-radius: 8px; padding: 10px 12px; color: var(--ink); font-family: var(--font-body); font-size: max(16px, .9rem); }
        /* max(16px, …) is functional, not typographic: Safari zooms the page
           on a focused input under 16px and never zooms back. Set here rather
           than relying on mobile-fit.css's bare input rule, because this
           block is injected into the body and would win on source order —
           the same trap .ihype-consent-btn fell into.

           THE FIELD MUST NOT BE ALLOWED TO SHRINK TO NOTHING, and it was.
           This row used to be a non-wrapping flex with min-width: 0 on the
           input, added to stop the row pushing past the viewport. It did that
           by letting the field absorb every pixel the button did not want —
           and the button holds its intrinsic width, because its label is
           white-space: nowrap. Measured on the built page: 140px of field
           at 393px, 67px at 320px. About twelve characters of an email
           address, and four. The owner reported it from a real iPhone after
           submitting the wrong address, which is exactly what a field you
           cannot read produces.

           min-width: min(14rem, 100%) keeps both properties instead of
           trading one for the other: never narrower than 14rem while the
           container allows it, never wider than the container, so the row
           still cannot overflow. When 14rem plus the button will not fit, the
           row WRAPS and the button takes its own full-width line — which is
           the right phone layout anyway; a field beside a submit button is a
           desktop pattern. 44px floors on both, per MOBILE.md: the row
           measured 41px, so the control was under the tap target too. */
        .beta-access-row button { flex: 0 0 auto; min-height: 44px; background: var(--accent); color: var(--ink-on-accent); border: none; border-radius: 8px; padding: 10px 16px; font-family: var(--font-display); font-weight: 700; font-size: 0.9375rem; cursor: pointer; white-space: nowrap; }
        .beta-access-row button:disabled { opacity: .6; cursor: default; }
        /* Full width on its own line below MOBILE.md's ONE breakpoint, rather
           than letting the button flex-grow: growing it fills the line on a
           phone and also stretches "Request access" to 564px on a desktop,
           which measured worse than the bug being fixed. flex-basis: 100%
           forces the wrap deterministically instead of depending on where the
           natural wrap happens to fall for a given label length. */
        @media (max-width: 620px) { .beta-access-row button { flex: 1 0 100%; } }
        .beta-access-error { font-size: 0.9375rem; color: var(--accent-text); margin: 0; }
        .beta-access-sent p { margin: 0; font-size: 0.9375rem; color: var(--ink-2); }
      `}</style>
    </form>
  );
}
