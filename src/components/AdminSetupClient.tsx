'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import { useI18n } from '@/components/I18nProvider';

type Step = 'idle' | 'creating' | 'registering' | 'done' | 'error';

export function AdminSetupClient() {
  const { t } = useI18n();
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setStep('creating');
    setStatus(t('adminSetupClient.creatingAccount', 'Creating account...'));

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : `${t('adminSetupClient.failedWithStatus', 'Failed')} (${res.status}).`);
      }

      setStep('registering');
      setStatus(t('adminSetupClient.registerPasskeyPrompt', 'Register your passkey now — follow your browser prompt.'));

      const optRes = await fetch('/api/auth/passkey/register-first');
      const options = await optRes.json();
      if (!optRes.ok) {
        throw new Error(typeof options.error === 'string' ? options.error : t('adminSetupClient.couldNotStartRegistration', 'Could not start passkey registration.'));
      }

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/passkey/register-first', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation)
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        throw new Error(typeof verifyData.error === 'string' ? verifyData.error : t('adminSetupClient.verificationFailed', 'Passkey verification failed.'));
      }

      setStep('done');
      setStatus(t('adminSetupClient.doneRedirecting', 'Done! Redirecting to admin...'));
      setTimeout(() => router.push('/admin'), 700);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : t('adminSetupClient.somethingWentWrong', 'Something went wrong.'));
    }
  }

  const busy = step === 'creating' || step === 'registering';

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        color: 'var(--ink)',
        borderRadius: 'var(--radius-card)',
        padding: 28,
        boxShadow: 'var(--shadow)',
        border: '1px solid var(--hair-80)'
      }}
    >
      <h1 style={{ margin: '0 0 6px', fontSize: '1.375rem' }}>{t('adminSetupClient.heading', 'Admin setup')}</h1>
      <p style={{ margin: '0 0 18px', opacity: 0.75, fontSize: '0.9375rem' }}>
        {t('adminSetupClient.descriptionPrefix', 'Set up admin access for')} <strong>admin@ihype.org</strong>. {t('adminSetupClient.descriptionSuffix', 'Requires')} <code>ALLOW_ADMIN_SETUP=true</code> {t('adminSetupClient.descriptionSuffix2', 'and should be disabled after the first passkey is registered.')}
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: '0.9375rem', marginBottom: 6 }}>ADMIN_SETUP_SECRET</span>
          <input
            type="password"
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            disabled={busy || step === 'done'}
            autoComplete="off"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--hair-150)',
              background: 'var(--bg-2)',
              color: 'inherit',
              fontSize: '0.9375rem'
            }}
          />
        </label>

        <button
          type="submit"
          disabled={busy || step === 'done' || !secret}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 12,
            background: 'var(--accent)',
            color: 'var(--ink-on-accent)',
            border: 'none',
            fontWeight: 600,
            cursor: busy ? 'progress' : 'pointer',
            opacity: busy || !secret ? 0.7 : 1
          }}
        >
          {step === 'creating'
            ? t('adminSetupClient.creatingAccount', 'Creating account...')
            : step === 'registering'
              ? t('adminSetupClient.registeringPasskey', 'Registering passkey...')
              : step === 'done'
                ? t('adminSetupClient.done', 'Done')
                : t('adminSetupClient.createAdminAccount', 'Create admin account')}
        </button>
      </form>

      {status ? (
        <p style={{ marginTop: 16, fontSize: '0.9375rem', opacity: 0.85 }}>{status}</p>
      ) : null}
      {error ? (
        <p style={{ marginTop: 12, fontSize: '0.9375rem', color: 'var(--danger)' }}>{error}</p>
      ) : null}
    </div>
  );
}
