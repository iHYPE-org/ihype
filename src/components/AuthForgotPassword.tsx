'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { postJson } from '@/lib/api-client';
import { AuthSignalShell, getErrorMessage } from '@/components/AuthShared';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [company, setCompany] = useState('');

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const payload = await postJson<{ message?: string }>('/api/auth/password-reset/request', { email, company });
      setCodeRequested(true);
      setMessage(payload.message || 'If that email exists, a reset passcode has been sent.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not request a reset code.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const payload = await postJson<{ message?: string }>('/api/auth/password-reset/confirm', {
        email,
        code,
        password,
        confirmPassword
      });
      setMessage(payload.message || 'Password updated.');
      setCode('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your password.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      badge="Password reset"
      cardSubtitle="Request a temporary code, then enter it within the 5-minute reset window."
      cardTitle={codeRequested ? 'Enter your reset code' : 'Reset your password'}
      description="Reset codes are single-purpose and short-lived. If an email is not connected to an account, iHYPE keeps the response private."
      eyebrow="Account recovery"
      highlight="Reset securely."
      signals={[
        { label: 'Window', value: '5 min', detail: 'Temporary reset code' },
        { label: 'Privacy', value: 'Quiet', detail: 'No account enumeration' },
        { label: 'Return', value: 'Sign in', detail: 'Back to your lane' }
      ]}
      title="Need a new key?"
    >
      {!codeRequested ? (
        <form className="form" onSubmit={requestReset}>
          <label className="field">
            <span>Email</span>
            <input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending...' : 'Send reset code'}
          </button>
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
        </form>
      ) : (
        <form className="form" onSubmit={confirmReset}>
          <label className="field">
            <span>Email</span>
            <input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="field">
            <span>6-digit reset code</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{6}"
              required
              type="text"
              value={code}
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
      )}

      {message ? <p className="status-note">{message}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}

      <div className="auth-route-links">
        <Link className="text-link" href="/login">
          Back to sign in
        </Link>
      </div>
    </AuthSignalShell>
  );
}
