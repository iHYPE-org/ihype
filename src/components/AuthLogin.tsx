'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import {
  AuthSignalShell,
  MagicLinkButton,
  getErrorMessage,
  getPasskeyDiagnostics,
  trackSignupFunnel,
} from '@/components/AuthShared';
import type { AuthMethod } from '@/components/AuthShared';

export function LoginScreen({
  initialIdentifier = '',
  justRegistered = false
}: {
  initialIdentifier?: string;
  justRegistered?: boolean;
}) {
  const [mode, setMode] = useState<AuthMethod>(justRegistered ? 'email' : 'passkey');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [emailStep, setEmailStep] = useState<'credentials' | 'code'>('credentials');
  const [message] = useState(
    justRegistered ? 'Account created. Sign in with your email code, then add a passkey from Settings when ready.' : ''
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  async function signInWithPasskey() {
    setError('');
    setIsSubmitting(true);
    try {
      const callbackUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('callbackUrl') : null;
      const query = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '';
      const optRes = await fetch(`/api/auth/passkey/auth${query}`);
      if (!optRes.ok) {
        const errBody = await optRes.json().catch(() => ({}));
        throw new Error(typeof errBody.error === 'string' ? errBody.error : 'Could not start passkey sign-in.');
      }
      const options = await optRes.json();
      if (!optRes.ok) {
        throw new Error(typeof options.error === 'string' ? options.error : 'Unable to start passkey sign-in.');
      }
      const assertion = await startAuthentication(options);
      const payload = await postJson<{ redirect?: string }>('/api/auth/passkey/auth', assertion);
      trackSignupFunnel('login_passkey_success', { method: 'passkey', step: 'login', ...getPasskeyDiagnostics() });
      window.location.href = resolvePostAuthRedirect(payload.redirect);
    } catch (err) {
      const reason = getErrorMessage(err, 'Passkey sign-in failed. Please try again or use email code.');
      trackSignupFunnel('login_passkey_failed', { method: 'passkey', step: 'login', reason, ...getPasskeyDiagnostics(err) });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = await postJson<{ challengeId: string; email?: string | null }>('/api/auth/otp/request', {
        identifier,
        password,
        tosAccepted: tosAccepted || undefined,
      });
      setChallengeId(payload.challengeId);
      setDeliveryEmail(payload.email || identifier);
      setEmailStep('code');
      trackSignupFunnel('login_email_code_requested', { method: 'email', step: 'login' });
    } catch (err) {
      const reason = getErrorMessage(err, 'Could not send a sign-in code.');
      trackSignupFunnel('login_email_code_failed', { method: 'email', step: 'login', reason });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = await postJson<{ redirect?: string }>('/api/auth/otp/signin', { challengeId, otp });
      trackSignupFunnel('login_email_code_success', { method: 'email', step: 'login' });
      window.location.href = resolvePostAuthRedirect(payload.redirect);
    } catch (err) {
      const reason = getErrorMessage(err, 'Could not verify that code.');
      trackSignupFunnel('login_email_code_verify_failed', { method: 'email', step: 'login', reason });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      badge={mode === 'passkey' ? 'Passkey sign-in' : 'Email code sign-in'}
      cardSubtitle={
        mode === 'passkey'
          ? 'Use Face ID, Touch ID, or your device PIN. Email code stays available as a fallback.'
          : 'Enter your email or username, confirm your password, then use the one-time email code.'
      }
      cardTitle="Sign in to iHYPE"
      description="Fast sign-in when passkeys are available, with an email-code lane when the browser or device prompt gets in the way."
      eyebrow="Secure sign-in"
      highlight="Your lane."
      signals={[
        { label: 'Primary', value: 'Passkey', detail: 'Device biometrics' },
        { label: 'Fallback', value: 'Email code', detail: 'No stranded account' },
        { label: 'Session', value: '12 hours', detail: 'Short-lived auth' }
      ]}
      title="Sign in."
    >
      <div className="auth-method-grid" role="tablist" aria-label="Sign-in method">
        <button
          aria-selected={mode === 'passkey'}
          className={mode === 'passkey' ? 'auth-method-choice active' : 'auth-method-choice'}
          onClick={() => {
            setMode('passkey');
            setError('');
          }}
          type="button"
        >
          <strong>Passkey</strong>
          <span>Face ID, Touch ID, or device PIN.</span>
        </button>
        <button
          aria-selected={mode === 'email'}
          className={mode === 'email' ? 'auth-method-choice active' : 'auth-method-choice'}
          onClick={() => {
            setMode('email');
            setError('');
          }}
          type="button"
        >
          <strong>Email code</strong>
          <span>Password plus one-time inbox code.</span>
        </button>
      </div>

      {mode === 'passkey' ? (
        <>
          <button
            className="button"
            disabled={isSubmitting}
            onClick={signInWithPasskey}
            type="button"
          >
            {isSubmitting ? 'Checking passkey...' : 'Sign in with passkey'}
          </button>
          {error ? (
            <button
              className="button secondary"
              onClick={() => { setMode('email'); setError(''); }}
              type="button"
              style={{ marginTop: 8 }}
            >
              Use email instead
            </button>
          ) : null}
        </>
      ) : emailStep === 'credentials' ? (
        <form className="form" onSubmit={requestEmailCode}>
          <label className="field">
            <span>Email or username</span>
            <input
              autoComplete="username"
              onChange={(event) => setIdentifier(event.target.value)}
              required
              type="text"
              value={identifier}
            />
          </label>
          <label className="field">
            <span>Password <small style={{ opacity: 0.6 }}>(leave blank if you signed up with passkey)</small></span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <input
              checked={tosAccepted}
              onChange={e => setTosAccepted(e.target.checked)}
              type="checkbox"
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span>I agree to the <a href="/terms" style={{ color: 'inherit' }}>Terms of Service</a> and confirm I am 13 or older</span>
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending code...' : 'Send email code'}
          </button>
        </form>
      ) : (
        <form className="form" onSubmit={verifyEmailCode}>
          <p className="status-note">Enter the 6-digit code sent to {deliveryEmail}.</p>
          <label className="field">
            <span>6-digit code</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{6}"
              required
              type="text"
              value={otp}
            />
          </label>
          <div className="auth-code-actions">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Verifying...' : 'Verify code'}
            </button>
            <button className="text-link" onClick={() => setEmailStep('credentials')} type="button">
              Change email
            </button>
          </div>
        </form>
      )}

      {message ? <p className="status-note">{message}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}

      <div className="auth-route-links">
        <Link className="text-link" href="/register">
          Join free
        </Link>
        <Link className="text-link" href="/forgot">
          Reset password
        </Link>
        <MagicLinkButton />
      </div>
    </AuthSignalShell>
  );
}
