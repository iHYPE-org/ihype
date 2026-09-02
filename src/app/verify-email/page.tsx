'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { isSafeLocalRedirect } from '@/lib/auth-redirects';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [code, setCode] = useState('');
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'confirming' | 'error'>('idle');

  async function handleResend() {
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmStatus('confirming');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', code }),
      });
      if (res.ok) {
        /* Same-origin paths only. `router.push` hard-navigates to an absolute
           URL, so an unchecked `callbackUrl` sent a member who had just typed
           a real code to whatever site the link named (security sweep,
           2026-09-02). */
        const callbackUrl = searchParams.get('callbackUrl');
        router.push(isSafeLocalRedirect(callbackUrl) ? callbackUrl : '/');
        router.refresh();
        return;
      }
      setConfirmStatus('error');
    } catch {
      setConfirmStatus('error');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 14,
        padding: '40px 48px',
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,.5)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 20 }}>✉</div>
        <h1 style={{
          fontFamily: 'var(--f-d)',
          fontWeight: 800,
          fontSize: '1.625rem',
          letterSpacing: '-.02em',
          color: 'var(--ink)',
          margin: '0 0 12px',
        }}>
          {t('verifyEmailPage.heading', 'Check your email')}
        </h1>
        <p style={{
          fontFamily: 'var(--f-m)',
          fontSize: '0.9375rem',
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          margin: '0 0 28px',
        }}>
          {t('verifyEmailPage.body', 'We sent a 6-digit verification code to your email address. Enter it below to verify your account and continue.')}
        </p>
        {status === 'sent' && (
          <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.9375rem', color: 'var(--role-venue)', marginBottom: 16 }}>
            {t('verifyEmailPage.codeSent', 'Verification code sent! Check your inbox.')}
          </p>
        )}
        {status === 'error' && (
          <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.9375rem', color: 'var(--accent-text)', marginBottom: 16 }}>
            {t('verifyEmailPage.genericError', 'Something went wrong. Please try again.')}
          </p>
        )}
        <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('verifyEmailPage.codePlaceholder', '000000')}
            maxLength={6}
            required
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--line-2)',
              borderRadius: 8,
              padding: '12px 16px',
              color: 'var(--ink)',
              fontFamily: 'var(--f-m)',
              fontSize: '1.125rem',
              letterSpacing: '.3em',
              textAlign: 'center',
            }}
          />
          {confirmStatus === 'error' && (
            <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.9375rem', color: 'var(--accent-text)', margin: 0 }}>
              {t('verifyEmailPage.codeInvalid', 'That code is invalid or expired. Request a new one below.')}
            </p>
          )}
          <button
            type="submit"
            disabled={confirmStatus === 'confirming' || code.length !== 6}
            style={{
              background: 'var(--accent)',
              color: 'var(--ink-on-accent)',
              border: 'none',
              borderRadius: 8,
              padding: '12px 28px',
              fontFamily: 'var(--f-m)',
              fontSize: '0.9375rem',
              letterSpacing: '.04em',
              cursor: confirmStatus === 'confirming' || code.length !== 6 ? 'not-allowed' : 'pointer',
              opacity: confirmStatus === 'confirming' || code.length !== 6 ? 0.6 : 1,
              width: '100%',
            }}
          >
            {confirmStatus === 'confirming' ? t('verifyEmailPage.verifying', 'Verifying…') : t('verifyEmailPage.verifyCode', 'Verify code')}
          </button>
        </form>
        <button
          onClick={handleResend}
          disabled={status === 'sending' || status === 'sent'}
          style={{
            background: 'transparent',
            color: 'var(--ink-2)',
            border: '1px solid var(--line-2)',
            borderRadius: 8,
            padding: '12px 28px',
            fontFamily: 'var(--f-m)',
            fontSize: '0.9375rem',
            letterSpacing: '.04em',
            cursor: status === 'sending' || status === 'sent' ? 'not-allowed' : 'pointer',
            opacity: status === 'sending' || status === 'sent' ? 0.6 : 1,
            width: '100%',
          }}
        >
          {status === 'sending' ? t('verifyEmailPage.sending', 'Sending…') : status === 'sent' ? t('verifyEmailPage.codeSentShort', 'Code sent!') : t('verifyEmailPage.resendCode', 'Resend code')}
        </button>
        <a
          href="/login"
          style={{
            display: 'block',
            marginTop: 16,
            fontFamily: 'var(--f-m)',
            fontSize: '0.9375rem',
            color: 'var(--ink-3)',
          }}
        >
          {t('verifyEmailPage.backToLogin', 'Back to login')}
        </a>
      </div>
    </div>
  );
}
